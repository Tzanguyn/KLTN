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

  console.log(`Running chat and appointments test suite on port ${port}...`);

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

  // 1. Authenticate users
  const gvToken = await login('giangvien@kltn.edu.vn');
  const svAssignedToken = await login('sinhvien@kltn.edu.vn'); // Assigned to group/topic
  const svOutsiderToken = await login('sinhvien2@kltn.edu.vn'); // Outsider student

  const gvUser = await prisma.user.findUnique({ where: { email: 'giangvien@kltn.edu.vn' } });
  const svUser = await prisma.user.findUnique({
    where: { email: 'sinhvien@kltn.edu.vn' },
    include: { studentProfile: true },
  });
  const svOutsiderUser = await prisma.user.findUnique({
    where: { email: 'sinhvien2@kltn.edu.vn' },
    include: { studentProfile: true },
  });

  assert(gvUser && svUser && svOutsiderUser);

  // Find an approved topic owned by this GVHD that svUser belongs to
  let testTopic = await prisma.topic.findFirst({
    where: {
      ownerId: gvUser.id,
      groups: {
        some: {
          members: {
            some: {
              studentId: svUser.studentProfile!.id,
            },
          },
        },
      },
    },
    include: {
      groups: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!testTopic) {
    const sem = await prisma.semester.findFirst({ where: { status: 'OPEN' } });
    const dept = await prisma.department.findFirst();
    testTopic = await prisma.topic.create({
      data: {
        title: 'Hệ thống KLTN Test Realtime Chat & Appointments',
        summary: 'Đề tài dùng cho integration test',
        status: 'APPROVED',
        ownerId: gvUser.id,
        semesterId: sem!.id,
        departmentId: dept!.id,
      },
      include: {
        groups: {
          include: {
            members: true,
          },
        },
      },
    });

    const grp = await prisma.group.create({
      data: {
        code: `GRP-CHAT-${Date.now().toString().slice(-4)}`,
        name: 'Nhóm Test Chat',
        topicId: testTopic.id,
        semesterId: sem!.id,
      },
    });

    await prisma.groupMember.create({
      data: {
        groupId: grp.id,
        studentId: svUser.studentProfile!.id,
        isLeader: true,
      },
    });
  }

  const topicId = testTopic.id;
  const testGroup = await prisma.group.findFirst({ where: { topicId } });
  assert(testGroup, 'Test group must exist');

  console.log(`Testing with topic: ${testTopic.title} (ID: ${topicId})`);

  // ==========================================
  // PART 1: TEST KÊNH CHAT NỘI BỘ (CONVERSATIONS)
  // ==========================================
  console.log('\n--- PART 1: CHAT / CONVERSATIONS TESTS ---');

  // Test 1a: Outsider student tries to view messages -> 403 Forbidden
  console.log('1a. Checking 403 Forbidden for non-member student...');
  const outsiderGetRes = await fetch(`${baseUrl}/conversations/${topicId}/messages`, {
    headers: { Authorization: `Bearer ${svOutsiderToken}` },
  });
  assert.equal(outsiderGetRes.status, 403, 'Outsider student must be rejected with 403');
  const outsiderGetData = await outsiderGetRes.json();
  assert(
    outsiderGetData.message.includes('không có quyền tham gia'),
    `Message should explain lack of permission: ${outsiderGetData.message}`,
  );
  console.log(' -> 403 Forbidden properly returned for non-member.');

  // Test 1b: Outsider student tries to send message -> 403 Forbidden
  console.log('1b. Checking 403 Forbidden on sending message for non-member...');
  const outsiderSendRes = await fetch(`${baseUrl}/conversations/${topicId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${svOutsiderToken}`,
    },
    body: JSON.stringify({ content: 'Xin chào em là người ngoài nhóm' }),
  });
  assert.equal(outsiderSendRes.status, 403);
  console.log(' -> 403 Forbidden properly returned on POST.');

  // Test 1c: Authorized student sends message with attachments
  console.log('1c. Authorized student sends message with attachments...');
  const studentAttachments = [
    {
      name: 'bao-cao-so-khoi.pdf',
      url: '/uploads/sample-attachment.pdf',
      type: 'application/pdf',
      size: 102400,
    },
  ];

  const studentMsgRes = await fetch(`${baseUrl}/conversations/${topicId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${svAssignedToken}`,
    },
    body: JSON.stringify({
      content: 'Thưa thầy, em đã hoàn thành tài liệu kiến trúc sơ bộ.',
      attachments: studentAttachments,
    }),
  });
  const studentMsgData = await studentMsgRes.json();
  assert.equal(studentMsgRes.status, 201, `Send message must return 201: ${JSON.stringify(studentMsgData)}`);
  assert(studentMsgData.data.id, 'Message must have id');
  assert.equal(studentMsgData.data.topicId, topicId);
  assert.equal(studentMsgData.data.senderId, svUser.id);
  assert.equal(studentMsgData.data.content, 'Thưa thầy, em đã hoàn thành tài liệu kiến trúc sơ bộ.');
  assert.deepEqual(studentMsgData.data.attachments, studentAttachments);
  assert(studentMsgData.data.sender, 'Sender info must be included');
  assert.equal(studentMsgData.data.sender.fullName, svUser.fullName);
  console.log(' -> Student message with attachments sent successfully.');

  // Verify GVHD received notification for student's message
  const gvNotifs = await prisma.notification.findMany({
    where: { userId: gvUser.id, type: 'CHAT' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  assert(
    gvNotifs.some((n: any) => n.title?.includes(svUser.fullName) || n.message?.includes('kiến trúc sơ bộ')),
    'GVHD must receive notification about new chat message',
  );
  console.log(' -> GVHD received notification for student message.');

  // Test 1d: GVHD replies to conversation
  console.log('1d. GVHD replies to conversation...');
  const gvMsgRes = await fetch(`${baseUrl}/conversations/${topicId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gvToken}`,
    },
    body: JSON.stringify({
      content: 'Thầy đã nhận được, nhóm làm tốt lắm. Chúng ta sẽ trao đổi trong buổi gặp tới.',
    }),
  });
  const gvMsgData = await gvMsgRes.json();
  assert.equal(gvMsgRes.status, 201);
  assert.equal(gvMsgData.data.senderId, gvUser.id);
  assert.equal(gvMsgData.data.topicId, topicId);
  console.log(' -> GVHD reply sent successfully.');

  // Verify Student received notification for GVHD's reply
  const svNotifs = await prisma.notification.findMany({
    where: { userId: svUser.id, type: 'CHAT' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  assert(
    svNotifs.some((n: any) => n.title?.includes(gvUser.fullName) || n.message?.includes('Thầy đã nhận được')),
    'Student must receive notification about GVHD reply',
  );
  console.log(' -> Student received notification for GVHD reply.');

  // Test 1e: GET /conversations/:topicId/messages with pagination & timeline
  console.log('1e. Getting messages timeline with pagination...');
  const timelineRes = await fetch(`${baseUrl}/conversations/${topicId}/messages?page=1&limit=10`, {
    headers: { Authorization: `Bearer ${svAssignedToken}` },
  });
  assert.equal(timelineRes.status, 200);
  const timelineData = await timelineRes.json();
  const messagesList = timelineData.data.items;
  const meta = timelineData.data.meta;

  assert(Array.isArray(messagesList), 'Items must be an array');
  assert(messagesList.length >= 2, 'Must contain at least the 2 messages sent');
  assert(meta.total >= 2, 'Meta total must be >= 2');
  assert.equal(meta.page, 1);
  assert.equal(meta.limit, 10);

  // Check timeline ordering (oldest first: student message then GV reply)
  const studentIdx = messagesList.findIndex((m: any) => m.id === studentMsgData.data.id);
  const gvIdx = messagesList.findIndex((m: any) => m.id === gvMsgData.data.id);
  assert(studentIdx !== -1 && gvIdx !== -1, 'Both messages must be in list');
  assert(studentIdx < gvIdx, 'Timeline must be ordered chronologically (student message before gv reply)');
  console.log(` -> Timeline & Pagination verified (${messagesList.length} messages, total: ${meta.total}).`);

  // ==========================================
  // PART 2: TEST QUẢN LÝ LỊCH HẸN (APPOINTMENTS)
  // ==========================================
  console.log('\n--- PART 2: APPOINTMENTS TESTS ---');

  // Test 2a: GVHD creates appointment with allowProposeTime: true
  console.log('2a. GVHD creates appointment with allowProposeTime: true...');
  const startsAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2); // 2 days later
  const endsAt = new Date(startsAt.getTime() + 1000 * 60 * 60); // 1 hour duration

  const createApptRes = await fetch(`${baseUrl}/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gvToken}`,
    },
    body: JSON.stringify({
      groupId: testGroup.id,
      title: 'Họp tiến độ tuần 3',
      description: 'Review kiến trúc hệ thống và phân công sprint 2',
      mode: 'ONLINE',
      meetingUrl: 'https://meet.google.com/test-kltn-meet',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      allowProposeTime: true,
    }),
  });
  const createApptData = await createApptRes.json();
  assert.equal(createApptRes.status, 201, `Create appointment failed: ${JSON.stringify(createApptData)}`);
  assert(createApptData.data.id);
  assert.equal(createApptData.data.status, 'PROPOSED');
  assert.equal(createApptData.data.allowProposeTime, true);
  const appt1Id = createApptData.data.id;
  console.log(' -> Appointment created with allowProposeTime: true.');

  // Verify Student received notification about new appointment
  const apptNotifs = await prisma.notification.findMany({
    where: { userId: svUser.id, type: 'APPOINTMENT' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  assert(
    apptNotifs.some((n: any) => n.title?.includes('Lịch hẹn mới') || n.message?.includes('Họp tiến độ tuần 3')),
    'Student must receive notification about new appointment',
  );
  console.log(' -> Student received notification for new appointment.');

  // Test 2b: Student checks their appointments via GET /appointments/me
  console.log('2b. Student checks GET /appointments/me...');
  const myApptRes = await fetch(`${baseUrl}/appointments/me`, {
    headers: { Authorization: `Bearer ${svAssignedToken}` },
  });
  assert.equal(myApptRes.status, 200);
  const myApptData = await myApptRes.json();
  assert(Array.isArray(myApptData.data), 'my appointments must be array');
  const foundAppt = myApptData.data.find((a: any) => a.id === appt1Id);
  assert(foundAppt, 'Created appointment must be visible in student appointments');
  assert.equal(foundAppt.title, 'Họp tiến độ tuần 3');
  assert(foundAppt.host, 'Host info must be populated');
  assert.equal(foundAppt.host.fullName, gvUser.fullName);
  console.log(' -> GET /appointments/me verified for student.');

  // Test 2c: Student proposes a new time via POST /appointments/:id/propose-time
  console.log('2c. Student proposes new time (allowProposeTime = true)...');
  const proposedTime = new Date(startsAt.getTime() + 1000 * 60 * 60 * 4); // 4 hours later
  const proposeRes = await fetch(`${baseUrl}/appointments/${appt1Id}/propose-time`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${svAssignedToken}`,
    },
    body: JSON.stringify({
      proposedTime: proposedTime.toISOString(),
      note: 'Em bị trùng lịch thi cuối kỳ buổi sáng, xin dời sang buổi chiều ạ',
    }),
  });
  const proposeData = await proposeRes.json();
  assert.equal(proposeRes.status, 200, `Propose time failed: ${JSON.stringify(proposeData)}`);
  assert.equal(proposeData.data.status, 'RESCHEDULED');
  assert.equal(new Date(proposeData.data.proposedTime).toISOString(), proposedTime.toISOString());
  assert.equal(proposeData.data.proposeNote, 'Em bị trùng lịch thi cuối kỳ buổi sáng, xin dời sang buổi chiều ạ');
  assert.equal(proposeData.data.proposedById, svUser.id);
  console.log(' -> Student successfully proposed new time (status RESCHEDULED).');

  // Verify GVHD received notification about proposed time
  const gvProposeNotifs = await prisma.notification.findMany({
    where: { userId: gvUser.id, type: 'APPOINTMENT' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  assert(
    gvProposeNotifs.some((n: any) => n.title?.includes('Đề xuất thời gian') || n.message?.includes('trùng lịch thi')),
    'GVHD must receive notification about proposed time',
  );
  console.log(' -> GVHD received notification for proposed time.');

  // Test 2d: GVHD confirms appointment via POST /appointments/:id/confirm
  console.log('2d. GVHD confirms appointment...');
  const confirmRes = await fetch(`${baseUrl}/appointments/${appt1Id}/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gvToken}`,
    },
  });
  const confirmData = await confirmRes.json();
  assert.equal(confirmRes.status, 200, `Confirm failed: ${JSON.stringify(confirmData)}`);
  assert.equal(confirmData.data.status, 'CONFIRMED');
  // StartsAt should have been updated to proposedTime
  assert.equal(new Date(confirmData.data.startsAt).toISOString(), proposedTime.toISOString());
  console.log(' -> Appointment successfully confirmed (status CONFIRMED, startsAt updated to proposedTime).');

  // Verify Student received notification for confirmed appointment
  const svConfirmNotifs = await prisma.notification.findMany({
    where: { userId: svUser.id, type: 'APPOINTMENT' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  assert(
    svConfirmNotifs.some((n: any) => n.title?.includes('xác nhận') && n.message?.includes('Họp tiến độ tuần 3')),
    'Student must receive notification about confirmed appointment',
  );
  console.log(' -> Student received notification for confirmed appointment.');

  // Test 2e: Case where allowProposeTime is false -> 400 Bad Request
  console.log('2e. Testing allowProposeTime = false rejection...');
  const strictApptRes = await fetch(`${baseUrl}/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gvToken}`,
    },
    body: JSON.stringify({
      groupId: testGroup.id,
      title: 'Lịch bảo vệ thử bắt buộc (Không dời)',
      mode: 'OFFLINE',
      location: 'Phòng A201',
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5 + 1000 * 60 * 60).toISOString(),
      allowProposeTime: false,
    }),
  });
  const strictApptData = await strictApptRes.json();
  assert.equal(strictApptRes.status, 201);
  const strictApptId = strictApptData.data.id;

  const rejectProposeRes = await fetch(`${baseUrl}/appointments/${strictApptId}/propose-time`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${svAssignedToken}`,
    },
    body: JSON.stringify({
      proposedTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
      note: 'Em muốn xin dời lịch này',
    }),
  });
  assert.equal(rejectProposeRes.status, 400, 'Proposing time when allowProposeTime=false must return 400 Bad Request');
  const rejectProposeData = await rejectProposeRes.json();
  assert(
    rejectProposeData.message.includes('không cho phép đề xuất lại thời gian'),
    `Error message should explain restriction: ${rejectProposeData.message}`,
  );
  console.log(' -> 400 Bad Request properly rejected propose-time when allowProposeTime=false.');

  // Test 2f: Outsider student tries to propose or confirm appointment -> 403 Forbidden
  console.log('2f. Testing 403 Forbidden for outsider student on appointment actions...');
  const outsiderApptRes = await fetch(`${baseUrl}/appointments/${appt1Id}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${svOutsiderToken}` },
  });
  assert.equal(outsiderApptRes.status, 403, 'Outsider student must receive 403 on confirm');
  console.log(' -> 403 Forbidden verified for outsider.');

  await app.close();
  console.log('\n======================================================');
  console.log('ALL CHAT & APPOINTMENTS TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

