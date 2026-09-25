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

  console.log(`Running defense-scheduling integration tests on port ${port}...`);

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
    // 1. Login as Trưởng bộ môn
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
    const member1 = lecturers[1]; // Shared member between committee 1 & 2
    const member2 = lecturers[2];
    const member3 = lecturers[3];

    // Find a student
    const studentProfile = await prisma.studentProfile.findFirst({
      include: { user: true },
    });
    assert(studentProfile, 'Student profile required for test');

    // Create 2 test topics & groups
    const topic1 = await prisma.topic.create({
      data: {
        title: 'Đề tài Xếp Lịch Test 1',
        ownerId: advisorLec.userId,
        departmentId: department.id,
        semesterId: semester.id,
        status: 'APPROVED',
      },
    });

    const group1 = await prisma.group.create({
      data: {
        code: `GRP_SCH_1_${Date.now().toString().slice(-4)}`,
        name: 'Nhóm Xếp Lịch 1',
        status: 'ACTIVE',
        semesterId: semester.id,
        topicId: topic1.id,
        midtermStatus: 'CONTINUE',
      },
    });

    await prisma.groupMember.create({
      data: {
        groupId: group1.id,
        studentId: studentProfile.id,
        isLeader: true,
      },
    });

    const topic2 = await prisma.topic.create({
      data: {
        title: 'Đề tài Xếp Lịch Test 2',
        ownerId: advisorLec.userId,
        departmentId: department.id,
        semesterId: semester.id,
        status: 'APPROVED',
      },
    });

    const group2 = await prisma.group.create({
      data: {
        code: `GRP_SCH_2_${Date.now().toString().slice(-4)}`,
        name: 'Nhóm Xếp Lịch 2',
        status: 'ACTIVE',
        semesterId: semester.id,
        topicId: topic2.id,
        midtermStatus: 'CONTINUE',
      },
    });

    // Create Committee 1: contains member1, member2, member3
    const committee1 = await prisma.defenseCommittee.create({
      data: {
        name: `Hội đồng Test Xếp Lịch 01 - ${Date.now()}`,
        departmentId: department.id,
        members: {
          create: [
            { userId: member1.userId, role: 'Chủ tịch' },
            { userId: member2.userId, role: 'Thư ký' },
            { userId: member3.userId, role: 'Ủy viên phản biện' },
          ],
        },
      },
      include: { members: true },
    });

    // Create Committee 2: also contains member1 (shared), advisorLec, member2
    const committee2 = await prisma.defenseCommittee.create({
      data: {
        name: `Hội đồng Test Xếp Lịch 02 - ${Date.now()}`,
        departmentId: department.id,
        members: {
          create: [
            { userId: member1.userId, role: 'Chủ tịch' }, // SHARED MEMBER
            { userId: advisorLec.userId, role: 'Thư ký' },
            { userId: member3.userId, role: 'Ủy viên' },
          ],
        },
      },
      include: { members: true },
    });

    // TEST 1: Missing required target (neither committeeId nor groupId) -> 400
    console.log('3. Testing POST /defense-schedules: Missing committeeId/groupId must return 400...');
    const missingTargetRes = await fetch(`${baseUrl}/defense-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        ngayGio: '2026-10-25T08:00:00.000Z',
        room: 'B102',
      }),
    });
    assert.equal(missingTargetRes.status, 400, 'Expected 400 for missing target');
    console.log(' -> Missing committeeId/groupId check verified successfully.');

    // TEST 2: endsAt <= startsAt -> 400
    console.log('4. Testing POST /defense-schedules: endsAt <= startsAt must return 400...');
    const invalidTimeRes = await fetch(`${baseUrl}/defense-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: group1.id,
        committeeId: committee1.id,
        startsAt: '2026-10-25T10:00:00.000Z',
        endsAt: '2026-10-25T09:00:00.000Z',
        room: 'B102',
      }),
    });
    assert.equal(invalidTimeRes.status, 400, 'Expected 400 for endsAt <= startsAt');
    console.log(' -> Invalid time interval check verified successfully.');

    // TEST 3: Successful scheduling of Group 1
    console.log('5. Testing POST /defense-schedules: Successful scheduling of Group 1...');
    const successRes1 = await fetch(`${baseUrl}/defense-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: group1.id,
        committeeId: committee1.id,
        startsAt: '2026-10-25T08:00:00.000Z',
        endsAt: '2026-10-25T09:30:00.000Z',
        room: 'Phòng B102',
      }),
    });
    const successJson1 = await successRes1.json();
    assert.equal(successRes1.status, 201, `Failed to schedule group 1: ${JSON.stringify(successJson1)}`);
    assert.equal(successJson1.data.room, 'Phòng B102');
    console.log(' -> Group 1 scheduled successfully.');

    // TEST 4: Room clash check -> 400
    console.log('6. Testing POST /defense-schedules: Room clash must return 400...');
    // Attempt to schedule group 2 in same room 'Phòng B102' overlapping (09:00 to 10:30)
    const roomClashRes = await fetch(`${baseUrl}/defense-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: group2.id,
        committeeId: committee2.id,
        startsAt: '2026-10-25T09:00:00.000Z',
        endsAt: '2026-10-25T10:30:00.000Z',
        room: 'phòng b102', // test case-insensitivity
      }),
    });
    const roomClashJson = await roomClashRes.json();
    assert.equal(roomClashRes.status, 400, 'Expected 400 for room clash');
    assert(
      roomClashJson.message.includes('Xung đột phòng'),
      `Expected message to mention 'Xung đột phòng', got: ${roomClashJson.message}`,
    );
    console.log(' -> Room clash check verified successfully.');

    // TEST 5: Committee member clash check -> 400
    console.log('7. Testing POST /defense-schedules: Committee member clash must return 400...');
    // Attempt to schedule committee 2 in different room 'Phòng C301' but overlapping time (08:30 to 10:00)
    // member1 is in both committee 1 and committee 2!
    const memberClashRes = await fetch(`${baseUrl}/defense-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: group2.id,
        committeeId: committee2.id,
        startsAt: '2026-10-25T08:30:00.000Z',
        endsAt: '2026-10-25T10:00:00.000Z',
        room: 'Phòng C301',
      }),
    });
    const memberClashJson = await memberClashRes.json();
    assert.equal(memberClashRes.status, 400, 'Expected 400 for committee member clash');
    assert(
      memberClashJson.message.includes('Xung đột lịch thành viên hội đồng'),
      `Expected message to mention 'Xung đột lịch thành viên hội đồng', got: ${memberClashJson.message}`,
    );
    console.log(' -> Committee member clash check verified successfully.');

    // TEST 6: Non-conflicting schedule -> 201
    console.log('8. Testing POST /defense-schedules: Non-conflicting time & room succeeds...');
    const successRes2 = await fetch(`${baseUrl}/defense-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: group2.id,
        committeeId: committee2.id,
        startsAt: '2026-10-25T10:00:00.000Z',
        endsAt: '2026-10-25T11:30:00.000Z',
        room: 'Phòng B102', // After group 1 finishes
      }),
    });
    const successJson2 = await successRes2.json();
    assert.equal(successRes2.status, 201, `Failed non-conflicting schedule: ${JSON.stringify(successJson2)}`);
    console.log(' -> Non-conflicting schedule created successfully.');

    // TEST 7: Notifications check
    console.log('9. Checking notifications created in DB for student, GVHD, and committee members...');
    const studentNotif = await prisma.notification.findFirst({
      where: {
        userId: studentProfile.userId,
        type: 'DEFENSE',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(studentNotif, 'Notification for student must exist');
    assert(studentNotif.content.includes('Phòng B102'), 'Notification content must include room');

    const advisorNotif = await prisma.notification.findFirst({
      where: {
        userId: advisorLec.userId,
        type: 'DEFENSE',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(advisorNotif, 'Notification for advisor must exist');

    const memberNotif = await prisma.notification.findFirst({
      where: {
        userId: member1.userId,
        type: 'DEFENSE',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(memberNotif, 'Notification for committee member must exist');
    console.log(' -> Notifications for all stakeholders verified in DB.');

    // TEST 8: GET /defense-schedules
    console.log('10. Testing GET /defense-schedules...');
    const getRes = await fetch(`${baseUrl}/defense-schedules?semesterId=${semester.id}`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    const getJson = await getRes.json();
    assert.equal(getRes.status, 200);
    assert(Array.isArray(getJson.data), 'Expected array of schedules');
    const sch1 = getJson.data.find((s: any) => s.groupId === group1.id);
    assert(sch1, 'Created schedule for group 1 must appear in list');
    assert.equal(sch1.room, 'Phòng B102');
    console.log(' -> GET /defense-schedules verified successfully.');

    // 11. Cleanup test data
    console.log('11. Cleaning up test data...');
    await prisma.defenseSchedule.deleteMany({
      where: { groupId: { in: [group1.id, group2.id] } },
    });
    await prisma.defenseCommitteeMember.deleteMany({
      where: { committeeId: { in: [committee1.id, committee2.id] } },
    });
    await prisma.defenseCommittee.deleteMany({
      where: { id: { in: [committee1.id, committee2.id] } },
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

    console.log('\n🎉 ALL DEFENSE SCHEDULING TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runTests();
