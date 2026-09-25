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

  console.log(`Starting Midterm Evaluation Integration Tests on port ${port}...`);

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

  // Get test accounts
  const gv1User = await prisma.user.findUnique({
    where: { email: 'giangvien@kltn.edu.vn' },
    include: { lecturerProfile: true },
  });
  assert(gv1User && gv1User.lecturerProfile, 'GV1 user must exist');

  const gv2User = await prisma.user.findUnique({
    where: { email: 'giangvien2@kltn.edu.vn' },
    include: { lecturerProfile: true },
  });
  assert(gv2User && gv2User.lecturerProfile, 'GV2 user must exist');

  const tbmUser = await prisma.user.findUnique({
    where: { email: 'truongbomon@kltn.edu.vn' },
    include: { lecturerProfile: true },
  });
  assert(tbmUser && tbmUser.lecturerProfile, 'TBM user must exist');

  const svUser = await prisma.user.findUnique({
    where: { email: 'sinhvien@kltn.edu.vn' },
    include: { studentProfile: true },
  });
  assert(svUser && svUser.studentProfile, 'SV user must exist');

  const semester = await prisma.semester.findFirst({
    where: { status: 'OPEN' },
  });
  assert(semester, 'Active semester must exist');

  // Clean up any existing midterm evaluation config for semester
  await prisma.systemConfig.deleteMany({
    where: {
      key: { in: ['MIDTERM_CONFIRMATION_WINDOW', 'MIDTERM_EVALUATION_WINDOW', 'MIDTERM_CONFIRMATION_FROM', 'MIDTERM_CONFIRMATION_TO'] },
      semesterId: semester.id,
    },
  });

  // Login tokens
  const gv1Token = await login('giangvien@kltn.edu.vn');
  const gv2Token = await login('giangvien2@kltn.edu.vn');
  const tbmToken = await login('truongbomon@kltn.edu.vn');
  const svToken = await login('sinhvien@kltn.edu.vn');

  // Setup test Topic and Groups for GV1
  const topic1 = await prisma.topic.create({
    data: {
      title: 'Đề tài Test Giữa Kỳ 01 - AI in Health',
      capacity: 3,
      status: 'APPROVED',
      ownerId: gv1User.id,
      departmentId: gv1User.lecturerProfile.departmentId,
      semesterId: semester.id,
    },
  });

  const topic2 = await prisma.topic.create({
    data: {
      title: 'Đề tài Test Giữa Kỳ 02 - Blockchain Voting',
      capacity: 3,
      status: 'APPROVED',
      ownerId: gv1User.id,
      departmentId: gv1User.lecturerProfile.departmentId,
      semesterId: semester.id,
    },
  });

  const group1Code = `GRP_TEST_MID_${Date.now().toString().slice(-6)}_1`;
  const group1 = await prisma.group.create({
    data: {
      code: group1Code,
      name: `Nhóm Test Giữa Kỳ 1`,
      status: 'ACTIVE',
      topicId: topic1.id,
      semesterId: semester.id,
      midtermStatus: 'PENDING',
      members: {
        create: {
          studentId: svUser.studentProfile.id,
          isLeader: true,
        },
      },
    },
  });

  const reg1 = await prisma.registration.create({
    data: {
      studentId: svUser.studentProfile.id,
      lecturerId: gv1User.lecturerProfile.id,
      topicId: topic1.id,
      groupId: group1.id,
      semesterId: semester.id,
      status: 'APPROVED',
    },
  });

  const group2Code = `GRP_TEST_MID_${Date.now().toString().slice(-6)}_2`;
  const group2 = await prisma.group.create({
    data: {
      code: group2Code,
      name: `Nhóm Test Giữa Kỳ 2`,
      status: 'ACTIVE',
      topicId: topic2.id,
      semesterId: semester.id,
      midtermStatus: 'PENDING',
    },
  });

  try {
    // -------------------------------------------------------------
    // Test 1: RBAC & Preconditions
    // -------------------------------------------------------------
    console.log('1. Testing RBAC restrictions on /midterm-evaluations...');
    const unauthRes = await fetch(`${baseUrl}/midterm-evaluations/my-groups`);
    assert.equal(unauthRes.status, 401, 'Unauthenticated request must return 401 Unauthorized');

    const svGetRes = await fetch(`${baseUrl}/midterm-evaluations/my-groups`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    assert.equal(svGetRes.status, 403, 'Student access to /midterm-evaluations/my-groups must return 403 Forbidden');

    const svPostRes = await fetch(`${baseUrl}/midterm-evaluations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${svToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: group1.id,
        ketQua: 'CHO_LAM_TIEP',
      }),
    });
    assert.equal(svPostRes.status, 403, 'Student calling POST /midterm-evaluations must return 403 Forbidden');
    console.log(' -> RBAC restrictions verified.');

    // -------------------------------------------------------------
    // Test 2: Validation of POST /midterm-evaluations
    // -------------------------------------------------------------
    console.log('2. Testing payload validation on POST /midterm-evaluations...');
    const invalidResultRes = await fetch(`${baseUrl}/midterm-evaluations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gv1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: group1.id,
        ketQua: 'INVALID_RESULT',
      }),
    });
    assert.equal(invalidResultRes.status, 400, 'Invalid ketQua must return 400 Bad Request');

    const missingTargetRes = await fetch(`${baseUrl}/midterm-evaluations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gv1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ketQua: 'CHO_LAM_TIEP',
      }),
    });
    assert.equal(missingTargetRes.status, 400, 'Missing groupId and registrationId must return 400 Bad Request');
    console.log(' -> Validation rules verified.');

    // -------------------------------------------------------------
    // Test 3: Time window restrictions via SystemConfig
    // -------------------------------------------------------------
    console.log('3. Testing time window restrictions from SystemConfig...');

    // 3a. Future window -> not yet opened
    await prisma.systemConfig.create({
      data: {
        key: 'MIDTERM_CONFIRMATION_WINDOW',
        value: {
          from: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
          to: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString(),
        },
        semesterId: semester.id,
      },
    });

    const tooEarlyRes = await fetch(`${baseUrl}/midterm-evaluations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gv1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: group1.id,
        ketQua: 'CHO_LAM_TIEP',
      }),
    });
    const earlyJson = await tooEarlyRes.json();
    assert.equal(tooEarlyRes.status, 400, 'Evaluation before window opens must return 400');
    assert(earlyJson.message.includes('Chưa đến thời gian'), 'Error message must explain window is not open yet');

    // 3b. Past window -> expired
    await prisma.systemConfig.updateMany({
      where: { key: 'MIDTERM_CONFIRMATION_WINDOW', semesterId: semester.id },
      data: {
        value: {
          from: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
          to: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        },
      },
    });

    const tooLateRes = await fetch(`${baseUrl}/midterm-evaluations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gv1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: group1.id,
        ketQua: 'CHO_LAM_TIEP',
      }),
    });
    const lateJson = await tooLateRes.json();
    assert.equal(tooLateRes.status, 400, 'Evaluation after window closed must return 400');
    assert(lateJson.message.includes('hết thời hạn'), 'Error message must explain window is closed');

    // Reset window to currently OPEN
    await prisma.systemConfig.updateMany({
      where: { key: 'MIDTERM_CONFIRMATION_WINDOW', semesterId: semester.id },
      data: {
        value: {
          from: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
          to: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString(),
        },
      },
    });
    console.log(' -> Time window restrictions verified.');

    // -------------------------------------------------------------
    // Test 4: Ownership security
    // -------------------------------------------------------------
    console.log('4. Testing ownership authorization (GV2 cannot evaluate GV1 group)...');
    const wrongOwnerRes = await fetch(`${baseUrl}/midterm-evaluations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gv2Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: group1.id,
        ketQua: 'CHO_LAM_TIEP',
      }),
    });
    assert.equal(wrongOwnerRes.status, 403, 'Non-owner lecturer must receive 403 Forbidden');
    console.log(' -> Ownership authorization verified.');

    // -------------------------------------------------------------
    // Test 5: Reviewer assignment blocked on PENDING midtermStatus
    // -------------------------------------------------------------
    console.log('5. Testing reviewer assignment blocked when group is still PENDING midterm evaluation...');
    const assignPendingRes = await fetch(`${baseUrl}/defense/assignments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tbmToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: group1.id,
        lecturerId: gv2User.lecturerProfile.id,
        type: 'PRIMARY',
      }),
    });
    const assignPendingJson = await assignPendingRes.json();
    assert.equal(assignPendingRes.status, 400, 'Assigning reviewer to PENDING group must return 400');
    assert(
      assignPendingJson.message.includes('CHO_LAM_TIEP'),
      `Message must mention CHO_LAM_TIEP requirement: ${assignPendingJson.message}`,
    );
    console.log(' -> Blocking reviewer assignment on PENDING group verified.');

    // -------------------------------------------------------------
    // Test 6: Main Flow 1 - GVHD confirms CHO_LAM_TIEP
    // -------------------------------------------------------------
    console.log('6. Testing main flow: GVHD evaluates group with CHO_LAM_TIEP...');
    const evalContinueRes = await fetch(`${baseUrl}/midterm-evaluations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gv1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: group1.id,
        ketQua: 'CHO_LAM_TIEP',
        lyDo: 'Tiến độ rất tốt, đã hoàn thành 60% khối lượng đề tài',
      }),
    });
    const evalContinueJson = await evalContinueRes.json();
    assert.equal(evalContinueRes.status, 201, `Evaluation failed: ${JSON.stringify(evalContinueJson)}`);
    assert.equal(evalContinueJson.data.midtermStatus, 'CONTINUE');
    assert.equal(evalContinueJson.data.ketQua, 'CHO_LAM_TIEP');
    assert.equal(evalContinueJson.data.confirmedBy, gv1User.id);
    assert(evalContinueJson.data.midtermAt, 'midtermAt timestamp must be recorded');

    // Verify in database
    const updatedGroup1 = await prisma.group.findUnique({
      where: { id: group1.id },
    });
    assert.equal(updatedGroup1?.midtermStatus, 'CONTINUE');
    assert.equal(updatedGroup1?.midtermNote, 'Tiến độ rất tốt, đã hoàn thành 60% khối lượng đề tài');
    assert(updatedGroup1?.midtermAt);

    // Verify registration note updated
    const updatedReg1 = await prisma.registration.findUnique({
      where: { id: reg1.id },
    });
    assert(updatedReg1?.decidedAt);
    assert(updatedReg1?.decisionNote?.includes('Tiến độ rất tốt'));

    // Verify AuditLog recorded
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entity: 'Group',
        entityId: group1.id,
        action: 'MIDTERM_EVALUATION',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(auditLog, 'AuditLog must be recorded for MIDTERM_EVALUATION');

    // Verify Student received Notification
    const svNotif = await prisma.notification.findFirst({
      where: {
        userId: svUser.id,
        type: 'FEEDBACK',
        createdAt: { gte: new Date(Date.now() - 10000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(svNotif, 'Student must receive FEEDBACK notification for midterm evaluation');
    assert(svNotif.content.includes('CHO LÀM TIẾP'));

    // Verify Department Head received Notification
    const tbmNotif = await prisma.notification.findFirst({
      where: {
        userId: tbmUser.id,
        type: 'FEEDBACK',
        createdAt: { gte: new Date(Date.now() - 10000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(tbmNotif, 'Department manager must receive notification for midterm evaluation');
    assert(tbmNotif.content.includes('CHO LÀM TIẾP'));
    console.log(' -> CHO_LAM_TIEP flow and notifications verified.');

    // -------------------------------------------------------------
    // Test 7: Reviewer Assignment SUCCEEDS on CHO_LAM_TIEP group
    // -------------------------------------------------------------
    console.log('7. Testing reviewer assignment SUCCEEDS on CHO_LAM_TIEP group...');
    const assignSuccessRes = await fetch(`${baseUrl}/defense/assignments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tbmToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: group1.id,
        lecturerId: gv2User.lecturerProfile.id,
        type: 'PRIMARY',
      }),
    });
    assert.equal(assignSuccessRes.status, 201, 'Reviewer assignment must succeed for CHO_LAM_TIEP group');
    console.log(' -> Reviewer assignment for CHO_LAM_TIEP group verified.');

    // -------------------------------------------------------------
    // Test 8: Main Flow 2 - GVHD confirms DUNG_DE_TAI
    // -------------------------------------------------------------
    console.log('8. Testing main flow: GVHD evaluates group with DUNG_DE_TAI...');
    const evalStopRes = await fetch(`${baseUrl}/midterm-evaluations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gv1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: group2.id,
        ketQua: 'DUNG_DE_TAI',
        lyDo: 'Không đáp ứng yêu cầu tiến độ, chưa có sản phẩm demo',
      }),
    });
    const evalStopJson = await evalStopRes.json();
    assert.equal(evalStopRes.status, 201);
    assert.equal(evalStopJson.data.midtermStatus, 'STOPPED');
    assert.equal(evalStopJson.data.ketQua, 'DUNG_DE_TAI');

    // Verify in database
    const updatedGroup2 = await prisma.group.findUnique({
      where: { id: group2.id },
    });
    assert.equal(updatedGroup2?.midtermStatus, 'STOPPED');
    assert.equal(updatedGroup2?.midtermNote, 'Không đáp ứng yêu cầu tiến độ, chưa có sản phẩm demo');

    // -------------------------------------------------------------
    // Test 9: Reviewer assignment BLOCKED on DUNG_DE_TAI group
    // -------------------------------------------------------------
    console.log('9. Testing reviewer assignment BLOCKED on DUNG_DE_TAI group...');
    const assignStopRes = await fetch(`${baseUrl}/defense/assignments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tbmToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: group2.id,
        lecturerId: gv2User.lecturerProfile.id,
        type: 'PRIMARY',
      }),
    });
    const assignStopJson = await assignStopRes.json();
    assert.equal(assignStopRes.status, 400, 'Assigning reviewer to STOPPED group must return 400');
    assert(
      assignStopJson.message.includes('CHO_LAM_TIEP'),
      `Message must state only CHO_LAM_TIEP allowed: ${assignStopJson.message}`,
    );
    console.log(' -> Blocking reviewer assignment on STOPPED group verified.');

    // -------------------------------------------------------------
    // Test 10: GET /midterm-evaluations/my-groups
    // -------------------------------------------------------------
    console.log('10. Testing GET /midterm-evaluations/my-groups...');
    const myGroupsRes = await fetch(`${baseUrl}/midterm-evaluations/my-groups`, {
      headers: { Authorization: `Bearer ${gv1Token}` },
    });
    const myGroupsJson = await myGroupsRes.json();
    assert.equal(myGroupsRes.status, 200);
    assert(Array.isArray(myGroupsJson.data.groups), 'my-groups must return array of groups');
    assert(typeof myGroupsJson.data.isEvaluationWindowOpen === 'boolean');
    assert(myGroupsJson.data.evaluationWindow);

    const foundGroup1 = myGroupsJson.data.groups.find((g: any) => g.id === group1.id);
    assert(foundGroup1, 'Created group 1 must appear in my-groups');
    assert.equal(foundGroup1.midtermStatus, 'CONTINUE');
    assert.equal(foundGroup1.ketQuaMidterm, 'CHO_LAM_TIEP');
    assert.equal(foundGroup1.members.length, 1);
    assert.equal(foundGroup1.members[0].studentCode, svUser.studentProfile.studentCode);

    const foundGroup2 = myGroupsJson.data.groups.find((g: any) => g.id === group2.id);
    assert(foundGroup2, 'Created group 2 must appear in my-groups');
    assert.equal(foundGroup2.midtermStatus, 'STOPPED');
    assert.equal(foundGroup2.ketQuaMidterm, 'DUNG_DE_TAI');
    console.log(' -> GET /midterm-evaluations/my-groups verified.');

    // -------------------------------------------------------------
    // Test 11: Evaluation via registrationId
    // -------------------------------------------------------------
    console.log('11. Testing POST /midterm-evaluations via registrationId...');
    const evalByRegRes = await fetch(`${baseUrl}/midterm-evaluations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gv1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registrationId: reg1.id,
        ketQua: 'CHO_LAM_TIEP',
        lyDo: 'Cập nhật bổ sung qua registrationId',
      }),
    });
    assert.equal(evalByRegRes.status, 201);
    console.log(' -> Evaluation via registrationId verified.');

    console.log('\n=============================================================');
    console.log(' ALL 11 MIDTERM EVALUATION INTEGRATION TESTS PASSED 100%! ');
    console.log('=============================================================\n');
  } finally {
    // Cleanup created test data
    await prisma.reviewerAssignment.deleteMany({
      where: { groupId: { in: [group1.id, group2.id] } },
    });
    await prisma.registration.deleteMany({
      where: { id: reg1.id },
    });
    await prisma.groupMember.deleteMany({
      where: { groupId: { in: [group1.id, group2.id] } },
    });
    await prisma.group.deleteMany({
      where: { id: { in: [group1.id, group2.id] } },
    });
    await prisma.topic.deleteMany({
      where: { id: { in: [topic1.id, topic2.id] } },
    });
    await prisma.systemConfig.deleteMany({
      where: {
        key: 'MIDTERM_CONFIRMATION_WINDOW',
        semesterId: semester.id,
      },
    });

    await app.close();
  }
}

runTest().catch((err) => {
  console.error('Midterm Evaluation Test Failed:', err);
  process.exit(1);
});

