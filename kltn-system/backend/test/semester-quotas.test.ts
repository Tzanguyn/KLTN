import 'reflect-metadata';
import 'dotenv/config';
import * as assert from 'node:assert';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

async function runTest() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();
  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  console.log(`Starting Semester Quotas Integration Test on port ${port}...`);

  const prisma = app.get(PrismaService);

  // Helper login
  async function login(identifier: string, password = 'Password@123') {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const json = await res.json();
    assert.equal(res.status, 201, `Login failed for ${identifier}: ${JSON.stringify(json)}`);
    return json.data.accessToken as string;
  }

  // Ensure active semester
  const activeSemester = await prisma.semester.findFirst({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(activeSemester, 'Active semester must exist');

  await prisma.semester.update({
    where: { id: activeSemester.id },
    data: {
      registrationFrom: new Date(Date.now() - 1000 * 60 * 60 * 24),
      registrationTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  const testTitle1 = 'Đề tài Test Quota 1 - Hệ thống IoT';
  const testTitle2 = 'Đề tài Test Quota 2 - Học sâu Xử lý ảnh';
  const testTitle3 = 'Đề tài Test Quota 3 - Blockchain Bảo mật';

  // Cleanup old test data
  await prisma.topicApproval.deleteMany({
    where: { topic: { title: { in: [testTitle1, testTitle2, testTitle3] } } },
  });
  await prisma.topic.deleteMany({
    where: { title: { in: [testTitle1, testTitle2, testTitle3] } },
  });
  await prisma.auditLog.deleteMany({
    where: { entity: 'Semester', action: 'UPDATE_SEMESTER_QUOTAS' },
  });

  try {
    const svToken = await login('sinhvien@kltn.edu.vn');
    const gvToken = await login('giangvien@kltn.edu.vn');
    const tbmToken = await login('truongbomon@kltn.edu.vn');

    const gvUser = await prisma.user.findUnique({
      where: { email: 'giangvien@kltn.edu.vn' },
      include: { lecturerProfile: true },
    });
    const tbmUser = await prisma.user.findUnique({
      where: { email: 'truongbomon@kltn.edu.vn' },
    });
    assert.ok(gvUser && gvUser.lecturerProfile && tbmUser, 'Seed accounts must exist');
    const lecturerProfileId = gvUser.lecturerProfile.id;

    // 1. RBAC Checks
    console.log('1. Checking RBAC on /quotas endpoints...');

    // 1a. Student cannot GET /quotas -> 403
    const svGetRes = await fetch(`${baseUrl}/quotas?semesterId=${activeSemester.id}`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    assert.equal(svGetRes.status, 403, 'Student must not have access to GET /quotas');
    console.log(' -> Verified: Student blocked from GET /quotas (403)');

    // 1b. Lecturer cannot PUT /quotas -> 403
    const gvPutRes = await fetch(`${baseUrl}/quotas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvToken}` },
      body: JSON.stringify({
        semesterId: activeSemester.id,
        quotas: [{ lecturerId: lecturerProfileId, maxGroups: 10 }],
      }),
    });
    assert.equal(gvPutRes.status, 403, 'Lecturer must not have access to PUT /quotas');
    console.log(' -> Verified: Lecturer blocked from PUT /quotas (403)');

    // 2. Main API: GET /quotas?semesterId=
    console.log('2. Fetching quotas via GET /quotas?semesterId= as TRUONG_BO_MON...');
    const tbmGetRes = await fetch(`${baseUrl}/quotas?semesterId=${activeSemester.id}`, {
      headers: { Authorization: `Bearer ${tbmToken}` },
    });
    assert.equal(tbmGetRes.status, 200, 'GET /quotas must return 200');
    const tbmGetJson = await tbmGetRes.json();
    const quotasData = tbmGetJson.data?.items ?? tbmGetJson.data?.data ?? tbmGetJson.data;
    assert.ok(Array.isArray(quotasData), 'quotas list must be an array');
    const myLec = quotasData.find((l: any) => l.lecturerId === lecturerProfileId || l.userId === gvUser.id);
    assert.ok(myLec, 'Target lecturer must be found in quotas list');
    assert.ok(typeof myLec.maxGroups === 'number', 'maxGroups must be a number');
    assert.ok(typeof myLec.currentGroups === 'number', 'currentGroups must be a number');
    assert.ok(typeof myLec.remainingSlots === 'number', 'remainingSlots must be a number');
    console.log(` -> GET /quotas verified: Found lecturer with maxGroups: ${myLec.maxGroups}, current: ${myLec.currentGroups}`);

    const initialCurrent = myLec.currentGroups;
    console.log(`Lecturer initial load in this semester: ${initialCurrent}`);

    // 3. Main API: PUT /quotas { semesterId, quotas: [{ lecturerId, maxGroups }] }
    console.log(`3. Setting lecturer quota to ${initialCurrent + 1} via PUT /quotas...`);
    const putRes1 = await fetch(`${baseUrl}/quotas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
      body: JSON.stringify({
        semesterId: activeSemester.id,
        quotas: [
          {
            lecturerId: lecturerProfileId,
            maxGroups: initialCurrent + 1,
          },
        ],
      }),
    });
    assert.equal(putRes1.status, 200, 'PUT /quotas must return 200 OK');

    // Verify DB & GET /quotas reflects quota = initialCurrent + 1
    const tbmGetRes2 = await fetch(`${baseUrl}/quotas?semesterId=${activeSemester.id}`, {
      headers: { Authorization: `Bearer ${tbmToken}` },
    });
    const tbmGetJson2 = await tbmGetRes2.json();
    const quotasData2 = tbmGetJson2.data?.items ?? tbmGetJson2.data?.data ?? tbmGetJson2.data;
    const myLec2 = quotasData2.find((l: any) => l.lecturerId === lecturerProfileId);
    assert.equal(myLec2.maxGroups, initialCurrent + 1, `maxGroups for this semester must now be ${initialCurrent + 1}`);

    // Verify AuditLog was recorded
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        entity: 'Semester',
        entityId: activeSemester.id,
        action: 'UPDATE_SEMESTER_QUOTAS',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(auditRecord, 'AuditLog must be recorded for UPDATE_SEMESTER_QUOTAS');
    console.log(' -> PUT /quotas verified: Quota updated and AuditLog recorded.');

    // 4. Real-time Quota Enforcement: GV tạo đề tài
    console.log(`4. Testing Realtime check: Lecturer creates Topic 1 within quota (${initialCurrent + 1}/${initialCurrent + 1})...`);
    const topic1Res = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvToken}` },
      body: JSON.stringify({
        tenDeTai: testTitle1,
        moTa: 'Mô tả đề tài 1',
        yeuCauSinhVien: 'Yêu cầu 1',
        soLuongToiDa: 2,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(topic1Res.status, 201, 'Topic 1 must be created successfully');
    console.log(` -> Topic 1 created successfully (current load = ${initialCurrent + 1}/${initialCurrent + 1}).`);

    console.log(`4b. Testing Realtime check: Lecturer creates Topic 2 when quota is full (${initialCurrent + 1}/${initialCurrent + 1}) -> Blocked...`);
    const topic2ExceededRes = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvToken}` },
      body: JSON.stringify({
        tenDeTai: testTitle2,
        moTa: 'Mô tả đề tài 2',
        yeuCauSinhVien: 'Yêu cầu 2',
        soLuongToiDa: 2,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(topic2ExceededRes.status, 403, 'Topic 2 must be blocked with 403 Forbidden due to quota limit');
    const topic2ExceededJson = await topic2ExceededRes.json();
    assert.ok(
      topic2ExceededJson.message.includes('tối đa') || topic2ExceededJson.message.includes('hạn mức'),
      `Message must mention quota / limit, got: ${topic2ExceededJson.message}`,
    );
    console.log(` -> Verified: Topic 2 correctly blocked with 403: "${topic2ExceededJson.message}"`);

    // 5. Increase quota to initialCurrent + 2 via PUT /quotas and re-test realtime creation
    console.log(`5. Increasing lecturer quota to ${initialCurrent + 2} via PUT /quotas...`);
    const putRes2 = await fetch(`${baseUrl}/quotas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
      body: JSON.stringify({
        semesterId: activeSemester.id,
        quotas: [
          {
            lecturerId: lecturerProfileId,
            maxGroups: initialCurrent + 2,
          },
        ],
      }),
    });
    assert.equal(putRes2.status, 200, 'PUT /quotas must succeed');

    console.log('5b. Retrying Topic 2 after quota increase -> Should succeed...');
    const topic2AllowedRes = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvToken}` },
      body: JSON.stringify({
        tenDeTai: testTitle2,
        moTa: 'Mô tả đề tài 2',
        yeuCauSinhVien: 'Yêu cầu 2',
        soLuongToiDa: 2,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(topic2AllowedRes.status, 201, 'Topic 2 must now be created successfully');
    console.log(` -> Topic 2 created successfully (current load = ${initialCurrent + 2}/${initialCurrent + 2}).`);

    console.log('5c. Attempting Topic 3 when quota is full -> Should be blocked...');
    const topic3BlockedRes = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvToken}` },
      body: JSON.stringify({
        tenDeTai: testTitle3,
        moTa: 'Mô tả đề tài 3',
        yeuCauSinhVien: 'Yêu cầu 3',
        soLuongToiDa: 2,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(topic3BlockedRes.status, 403, 'Topic 3 must be blocked with 403 Forbidden');
    console.log(' -> Topic 3 blocked with 403 Forbidden as expected.');

    // 6. Check GET /quotas realtime workload reflects initialCurrent + 2 and isOverloaded = true
    const tbmGetRes3 = await fetch(`${baseUrl}/quotas?semesterId=${activeSemester.id}`, {
      headers: { Authorization: `Bearer ${tbmToken}` },
    });
    const tbmGetJson3 = await tbmGetRes3.json();
    const quotasData3 = tbmGetJson3.data?.items ?? tbmGetJson3.data?.data ?? tbmGetJson3.data;
    const myLec3 = quotasData3.find((l: any) => l.lecturerId === lecturerProfileId);
    assert.equal(myLec3.maxGroups, initialCurrent + 2);
    assert.equal(myLec3.currentGroups, initialCurrent + 2);
    assert.equal(myLec3.remainingSlots, 0);
    assert.equal(myLec3.isOverloaded, true);
    console.log(` -> GET /quotas realtime verified: maxGroups = ${initialCurrent + 2}, currentGroups = ${initialCurrent + 2}, remainingSlots = 0, isOverloaded = true.`);

    console.log('\nALL SEMESTER QUOTA TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    // Cleanup
    await prisma.topicApproval.deleteMany({
      where: { topic: { title: { in: [testTitle1, testTitle2, testTitle3] } } },
    });
    await prisma.topic.deleteMany({
      where: { title: { in: [testTitle1, testTitle2, testTitle3] } },
    });
    await prisma.lecturerQuota.deleteMany({
      where: { semesterId: activeSemester.id },
    });
    await app.close();
  }
}

void runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
