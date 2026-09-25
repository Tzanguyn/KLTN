import 'reflect-metadata';
import 'dotenv/config';
import * as assert from 'node:assert';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

async function runTests() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();
  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  console.log(`Running defense-committee integration tests on port ${port}...`);

  const prisma = app.get(PrismaService);

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

  try {
    // 1. Logins
    const headToken = await login('truongbomon@kltn.edu.vn');

    // 2. Setup test data
    console.log('2. Setting up test data in database...');
    const semester = await prisma.semester.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });
    assert(semester, 'Active semester required');

    const department = await prisma.department.findFirst();
    assert(department, 'Department required');

    const lecturers = await prisma.lecturerProfile.findMany({
      include: { user: true },
      take: 5,
    });
    assert(lecturers.length >= 4, 'At least 4 lecturers required for test');

    const advisorLec = lecturers[0];
    const member1 = lecturers[1];
    const member2 = lecturers[2];
    const member3 = lecturers[3];

    // Create qualified test group
    const topic1 = await prisma.topic.create({
      data: {
        title: 'Đề tài Hội Đồng Test 1 (CHO_LAM_TIEP)',
        ownerId: advisorLec.userId,
        departmentId: department.id,
        semesterId: semester.id,
        status: 'APPROVED',
      },
    });

    const group1 = await prisma.group.create({
      data: {
        code: `GRP_COM_TEST_1_${Date.now().toString().slice(-4)}`,
        name: 'Nhóm Hội Đồng Test 1',
        status: 'ACTIVE',
        semesterId: semester.id,
        topicId: topic1.id,
        midtermStatus: 'CONTINUE',
      },
    });

    // Create unqualified test group
    const topic2 = await prisma.topic.create({
      data: {
        title: 'Đề tài Hội Đồng Test 2 (STOPPED)',
        ownerId: member1.userId,
        departmentId: department.id,
        semesterId: semester.id,
        status: 'APPROVED',
      },
    });

    const groupStopped = await prisma.group.create({
      data: {
        code: `GRP_COM_TEST_2_${Date.now().toString().slice(-4)}`,
        name: 'Nhóm Dừng Tiến Độ Test 2',
        status: 'ACTIVE',
        semesterId: semester.id,
        topicId: topic2.id,
        midtermStatus: 'STOPPED',
      },
    });

    // TEST 1: Số lượng thành viên tối thiểu < 3 -> 400
    console.log('3. Testing POST /defense-committees: memberIds < 3 must return 400...');
    const minMembersRes = await fetch(`${baseUrl}/defense-committees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        semesterId: semester.id,
        groupIds: [group1.id],
        memberIds: [member1.userId, member2.userId], // only 2 members
        tenHoiDong: 'Hội đồng Test Thiếu Thành Viên',
      }),
    });
    assert.equal(minMembersRes.status, 400, 'Less than 3 members must return 400');
    console.log(' -> Minimum members check (< 3) verified successfully.');

    // TEST 2: Trùng lặp thành viên -> 400
    console.log('4. Testing POST /defense-committees: Duplicate memberIds must return 400...');
    const dupMembersRes = await fetch(`${baseUrl}/defense-committees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        semesterId: semester.id,
        groupIds: [group1.id],
        memberIds: [member1.userId, member2.userId, member1.userId], // duplicate
        tenHoiDong: 'Hội đồng Test Trùng Thành Viên',
      }),
    });
    assert.equal(dupMembersRes.status, 400, 'Duplicate members must return 400');
    console.log(' -> Duplicate memberIds check verified successfully.');

    // TEST 3: Nhóm chưa CHO_LAM_TIEP -> 400
    console.log('5. Testing POST /defense-committees: Group not CHO_LAM_TIEP must return 400...');
    const unqualRes = await fetch(`${baseUrl}/defense-committees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        semesterId: semester.id,
        groupIds: [groupStopped.id],
        memberIds: [advisorLec.userId, member2.userId, member3.userId],
      }),
    });
    assert.equal(unqualRes.status, 400, 'Assigning stopped group to committee must return 400');
    console.log(' -> Not CHO_LAM_TIEP check verified successfully.');

    // TEST 4: Xung đột vai trò (Không chấm nhóm mình hướng dẫn) -> 400
    console.log('6. Testing POST /defense-committees: Advisor as committee member must return 400...');
    const conflictRes = await fetch(`${baseUrl}/defense-committees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        semesterId: semester.id,
        groupIds: [group1.id], // advisor is advisorLec
        memberIds: [advisorLec.userId, member1.userId, member2.userId], // includes advisorLec!
        tenHoiDong: 'Hội đồng Xung Đột Vai Trò',
      }),
    });
    assert.equal(conflictRes.status, 400, 'Advisor as committee member must return 400');
    const conflictJson = await conflictRes.json();
    assert.ok(
      conflictJson.message?.includes('Xung đột vai trò') || conflictJson.message?.includes('Giảng viên hướng dẫn'),
      `Message must mention role conflict: ${conflictJson.message}`,
    );
    console.log(' -> Role conflict check (advisor cannot evaluate own group) verified successfully.');

    // TEST 5: Thành lập hội đồng hợp lệ -> 201
    console.log('7. Testing POST /defense-committees: Successful creation of committee...');
    const successRes = await fetch(`${baseUrl}/defense-committees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        semesterId: semester.id,
        groupIds: [group1.id],
        memberIds: [member1.userId, member2.userId, member3.userId], // no conflict
        tenHoiDong: 'Hội đồng Bảo vệ KLTN Số 99 - Test',
      }),
    });
    const successJson = await successRes.json();
    assert.ok(successRes.status === 201 || successRes.status === 200, `Must return 201/200: ${JSON.stringify(successJson)}`);
    const createdCommittee = successJson.data;
    assert.equal(createdCommittee.name, 'Hội đồng Bảo vệ KLTN Số 99 - Test');
    assert.equal(createdCommittee.members.length, 3);
    const roles = createdCommittee.members.map((m: any) => m.role);
    assert.ok(roles.includes('Chủ tịch'), 'Must have Chủ tịch');
    assert.ok(roles.includes('Thư ký'), 'Must have Thư ký');
    assert.ok(roles.includes('Ủy viên phản biện') || roles.includes('Ủy viên'), 'Must have Ủy viên');
    assert.equal(createdCommittee.assignedGroups.length, 1);
    assert.equal(createdCommittee.assignedGroups[0].id, group1.id);
    console.log(' -> Successful committee creation verified.');

    // Verify in DB that DefenseSchedule links group with committee
    const dbSchedule = await prisma.defenseSchedule.findFirst({
      where: { groupId: group1.id, committeeId: createdCommittee.id },
    });
    assert.ok(dbSchedule, 'DefenseSchedule linking group and committee must exist in DB');
    console.log(' -> Group-Committee linkage in DefenseSchedule verified in DB.');

    // TEST 6: GET /defense-committees
    console.log('8. Testing GET /defense-committees...');
    const getRes = await fetch(`${baseUrl}/defense-committees?semesterId=${semester.id}`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(getRes.status, 200, 'GET /defense-committees must return 200');
    const getJson = await getRes.json();
    const comList: any[] = getJson.data;
    const found = comList.find((c) => c.id === createdCommittee.id);
    assert.ok(found, 'Created committee must appear in list');
    assert.equal(found.groupCount, 1);
    console.log(' -> GET /defense-committees verified successfully.');

    // Cleanup
    console.log('9. Cleaning up test data...');
    await prisma.defenseSchedule.deleteMany({
      where: { groupId: { in: [group1.id, groupStopped.id] } },
    });
    await prisma.defenseCommitteeMember.deleteMany({
      where: { committeeId: createdCommittee.id },
    });
    await prisma.defenseCommittee.deleteMany({
      where: { id: createdCommittee.id },
    });
    await prisma.group.deleteMany({
      where: { id: { in: [group1.id, groupStopped.id] } },
    });
    await prisma.topic.deleteMany({
      where: { id: { in: [topic1.id, topic2.id] } },
    });

    console.log('\n🎉 ALL DEFENSE COMMITTEE TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    await app.close();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
