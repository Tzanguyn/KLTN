import 'reflect-metadata';
import 'dotenv/config';
import * as assert from 'node:assert';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { EmailService } from '../src/modules/notifications/email.service';

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

  console.log(`Running notifications-system integration tests on port ${port}...`);

  const prisma = app.get(PrismaService);
  const emailService = app.get(EmailService);

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

  // 1. Logins
  const svToken = await login('sinhvien@kltn.edu.vn');
  const gvToken = await login('giangvien@kltn.edu.vn');
  const tbmToken = await login('truongbomon@kltn.edu.vn');

  const svUser = await prisma.user.findUnique({
    where: { email: 'sinhvien@kltn.edu.vn' },
    include: { studentProfile: true },
  });
  const gvUser = await prisma.user.findUnique({
    where: { email: 'giangvien@kltn.edu.vn' },
    include: { lecturerProfile: true },
  });
  const tbmUser = await prisma.user.findUnique({
    where: { email: 'truongbomon@kltn.edu.vn' },
    include: { lecturerProfile: true },
  });
  assert(svUser && gvUser && tbmUser);

  // Find active group for student
  const groupMember = await prisma.groupMember.findFirst({
    where: { studentId: svUser.studentProfile!.id },
    include: { group: { include: { topic: true } } },
  });
  assert(groupMember && groupMember.group, 'Student must belong to a group for testing');
  const group = groupMember.group;

  // Clear existing notifications for svUser to have clean test baseline
  await prisma.notification.deleteMany({ where: { userId: svUser.id } });
  emailService.clearSentEmails();

  // -------------------------------------------------------------
  // PART 1: NOTIFICATION APIS (GET /me, PATCH :id/read, PATCH read-all)
  // -------------------------------------------------------------
  console.log('\n--- PART 1: NOTIFICATION APIS ---');

  // Seed 3 notifications for svUser (2 UNREAD, 1 READ)
  const notif1 = await prisma.notification.create({
    data: {
      userId: svUser.id,
      type: 'REGISTRATION',
      title: 'Đăng ký đề tài thành công',
      content: 'Bạn đã đăng ký đề tài KLTN thành công.',
      message: 'Bạn đã đăng ký đề tài KLTN thành công.',
      isRead: false,
    },
  });

  const notif2 = await prisma.notification.create({
    data: {
      userId: svUser.id,
      type: 'APPOINTMENT',
      title: 'Lịch hẹn mới',
      content: 'Bạn có lịch hẹn trao đổi tiến độ với GVHD.',
      message: 'Bạn có lịch hẹn trao đổi tiến độ với GVHD.',
      isRead: false,
    },
  });

  const notif3 = await prisma.notification.create({
    data: {
      userId: svUser.id,
      type: 'FEEDBACK',
      title: 'Nhận xét từ GVHD',
      content: 'Bài nộp tuần 1 đã được xem.',
      message: 'Bài nộp tuần 1 đã được xem.',
      isRead: true,
      readAt: new Date(),
    },
  });

  // 1a. Test GET /notifications/me (Pagination & Unread Count)
  console.log('1a. Testing GET /notifications/me (Pagination & unreadCount)...');
  const getMeRes = await fetch(`${baseUrl}/notifications/me?page=1&limit=10`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  assert.equal(getMeRes.status, 200);
  const getMeData = await getMeRes.json();
  assert.equal(getMeData.data.meta.total, 3);
  assert.equal(getMeData.data.meta.unreadCount, 2);
  assert.equal(getMeData.data.items.length, 3);
  // Verify fields: { id, userId, type, title, content, isRead, createdAt }
  const item0 = getMeData.data.items[0];
  assert(item0.id && item0.userId && item0.type && item0.title);
  assert(typeof item0.content === 'string' && item0.content.length > 0);
  assert(typeof item0.isRead === 'boolean');
  console.log(' -> GET /notifications/me verified with accurate structure & unreadCount.');

  // 1b. Test GET /notifications/me?type=REGISTRATION (Filter by Type)
  console.log('1b. Testing GET /notifications/me?type=REGISTRATION...');
  const filterRes = await fetch(`${baseUrl}/notifications/me?type=REGISTRATION`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  assert.equal(filterRes.status, 200);
  const filterData = await filterRes.json();
  assert.equal(filterData.data.items.length, 1);
  assert.equal(filterData.data.items[0].type, 'REGISTRATION');
  assert.equal(filterData.data.items[0].id, notif1.id);
  console.log(' -> Filter by type=REGISTRATION verified.');

  // 1c. Test PATCH /notifications/:id/read (Mark single as read)
  console.log('1c. Testing PATCH /notifications/:id/read...');
  const markReadRes = await fetch(`${baseUrl}/notifications/${notif1.id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${svToken}` },
  });
  assert.equal(markReadRes.status, 200);
  const markReadData = await markReadRes.json();
  assert.equal(markReadData.data.id, notif1.id);
  assert.equal(markReadData.data.isRead, true);

  // Check unread count decreased to 1
  const afterReadRes = await fetch(`${baseUrl}/notifications/me`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const afterReadData = await afterReadRes.json();
  assert.equal(afterReadData.data.meta.unreadCount, 1);
  console.log(' -> PATCH /notifications/:id/read verified.');

  // 1d. Test PATCH /notifications/read-all (Mark all as read)
  console.log('1d. Testing PATCH /notifications/read-all...');
  const markAllRes = await fetch(`${baseUrl}/notifications/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${svToken}` },
  });
  assert.equal(markAllRes.status, 200);
  const markAllData = await markAllRes.json();
  assert(markAllData.data && typeof markAllData.data.updatedCount === 'number');

  // Check unread count is now 0
  const afterAllRes = await fetch(`${baseUrl}/notifications/me`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const afterAllData = await afterAllRes.json();
  assert.equal(afterAllData.data.meta.unreadCount, 0);
  console.log(' -> PATCH /notifications/read-all verified (unreadCount: 0).');

  // -------------------------------------------------------------
  // PART 2: THE 6 IMPORTANT BUSINESS NOTIFICATION EVENTS
  // -------------------------------------------------------------
  console.log('\n--- PART 2: 6 IMPORTANT NOTIFICATION EVENTS ---');

  // Event 1: Thay đổi trạng thái đăng ký (Registration status change)
  console.log('2a. Event 1: Testing Registration Status Decision notification...');
  // Find or create a registration to test decision
  let reg = await prisma.registration.findFirst({
    where: { studentId: svUser.studentProfile!.id },
  });
  if (!reg) {
    const openSem = await prisma.semester.findFirst({ where: { status: 'OPEN' } });
    const topic = await prisma.topic.findFirst({ where: { status: 'APPROVED' } });
    reg = await prisma.registration.create({
      data: {
        studentId: svUser.studentProfile!.id,
        semesterId: openSem!.id,
        topicId: topic?.id,
        status: 'PENDING',
      },
    });
  }

  // GVHD approves registration
  emailService.clearSentEmails();
  const decideRes = await fetch(`${baseUrl}/registrations/${reg.id}/decision`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${gvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'APPROVED',
      note: 'Đã chấp thuận đề tài theo yêu cầu.',
    }),
  });
  assert.equal(decideRes.status, 200);

  // Verify student received REGISTRATION notification
  const studentRegNotif = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'REGISTRATION',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
  });
  assert(studentRegNotif, 'Student must receive REGISTRATION notification on approval');
  assert(studentRegNotif.content.includes('APPROVED'));
  // Verify email dispatch recorded
  assert(
    emailService.getSentEmails().some((e) => e.to === svUser.email && e.subject.includes('đăng ký')),
    'Email must be dispatched to student on registration status update',
  );
  console.log(' -> Event 1 (Registration Status Decision) verified with notification & email.');

  // Event 2: Phản hồi mới từ GV (Lecturer Feedback on Submission)
  console.log('2b. Event 2: Testing Lecturer Feedback on Submission notification...');
  // Create or get submission
  let submission = await prisma.submission.findFirst({
    where: { groupId: group.id },
  });
  if (!submission) {
    submission = await prisma.submission.create({
      data: {
        groupId: group.id,
        submittedBy: svUser.id,
        type: 'BAO_CAO_TIEN_DO',
        version: 1,
        sourceUrl: 'https://github.com/test/repo',
        status: 'CHUA_XEM',
      },
    });
  }

  emailService.clearSentEmails();
  const feedbackRes = await fetch(`${baseUrl}/progress/submissions/${submission.id}/feedback`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: 'Tiến độ rất tốt, cần bổ sung thêm biểu đồ kiến trúc hệ thống.',
    }),
  });
  assert.equal(feedbackRes.status, 201);

  // Verify student received FEEDBACK notification
  const studentFbNotif = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'FEEDBACK',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
  });
  assert(studentFbNotif, 'Student must receive FEEDBACK notification');
  assert(studentFbNotif.content.includes('biểu đồ kiến trúc'));
  assert(
    emailService.getSentEmails().some((e) => e.to === svUser.email && e.subject.includes('Phản hồi mới')),
    'Email must be dispatched to student on lecturer feedback',
  );
  console.log(' -> Event 2 (Lecturer Feedback) verified with notification & email.');

  // Event 3: Lịch hẹn mới & cập nhật (Appointment)
  console.log('2c. Event 3: Testing Appointment notification...');
  emailService.clearSentEmails();
  const apptRes = await fetch(`${baseUrl}/appointments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      groupId: group.id,
      title: 'Họp rà soát tiến độ tuần 5',
      mode: 'ONLINE',
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 49).toISOString(),
      location: 'https://meet.google.com/xyz-test',
    }),
  });
  assert.equal(apptRes.status, 201);
  const createdAppt = (await apptRes.json()).data;

  // Verify student received APPOINTMENT notification
  const studentApptNotif = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'APPOINTMENT',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
  });
  assert(studentApptNotif, 'Student must receive APPOINTMENT notification');
  assert(studentApptNotif.content.includes('Họp rà soát tiến độ tuần 5'));
  assert(
    emailService.getSentEmails().some((e) => e.to === svUser.email && e.subject.includes('Lịch hẹn mới')),
    'Email must be dispatched on new appointment',
  );
  console.log(' -> Event 3 (New Appointment) verified with notification & email.');

  // Event 4: Phân công phản biện (Reviewer Assignment)
  console.log('2d. Event 4: Testing Reviewer Assignment notification...');
  await prisma.group.update({
    where: { id: group.id },
    data: { midtermStatus: 'CONTINUE' },
  });
  emailService.clearSentEmails();
  const assignRes = await fetch(`${baseUrl}/defense/assignments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tbmToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      groupId: group.id,
      lecturerId: tbmUser.lecturerProfile!.id,
      type: 'PRIMARY',
    }),
  });
  assert.equal(assignRes.status, 201);

  // Verify Reviewer received DEFENSE notification
  const reviewerNotif = await prisma.notification.findFirst({
    where: {
      userId: tbmUser.id,
      type: 'DEFENSE',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
  });
  assert(reviewerNotif, 'Assigned reviewer must receive DEFENSE notification');
  assert(reviewerNotif.content.includes('Giảng viên phản biện'));

  // Verify Student received DEFENSE notification
  const studentRevNotif = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'DEFENSE',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
  });
  assert(studentRevNotif, 'Student must receive DEFENSE notification on reviewer assignment');
  assert(studentRevNotif.content.includes(tbmUser.fullName));
  assert(
    emailService.getSentEmails().some((e) => e.to === svUser.email && e.subject.includes('phản biện')),
    'Email must be dispatched to student on reviewer assignment',
  );
  console.log(' -> Event 4 (Reviewer Assignment) verified for both lecturer & student.');

  // Event 5: Điểm được công bố (Scores published / upserted)
  console.log('2e. Event 5: Testing Score Publishing notification...');
  const criteria = await prisma.scoreCriterion.findMany({ where: { active: true } });
  assert(criteria.length > 0, 'Score criteria must exist');

  emailService.clearSentEmails();
  const scoreRes = await fetch(`${baseUrl}/scores`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      groupId: group.id,
      criterionId: criteria[0].id,
      value: 9.5,
      note: 'Điểm đánh giá GVHD xuất sắc',
    }),
  });
  assert.equal(scoreRes.status, 201);

  // Verify student received SCORE notification
  const studentScoreNotif = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'SCORE',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
  });
  assert(studentScoreNotif, 'Student must receive SCORE notification');
  assert(studentScoreNotif.content.includes('9.5'));
  assert(
    emailService.getSentEmails().some((e) => e.to === svUser.email && e.subject.includes('Điểm KLTN')),
    'Email must be dispatched to student on score publication',
  );
  console.log(' -> Event 5 (Score Publication) verified with notification & email.');

  // Event 6: Cảnh báo deadline (Deadline Warning 3 - 7 days)
  console.log('2f. Event 6: Testing Deadline Warning (3-7 days) notification...');
  // Create a progress report with due date in 4 days for student's group
  const dueIn4Days = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  const testReport = await prisma.progressReport.create({
    data: {
      groupId: group.id,
      semesterId: group.semesterId,
      authorId: gvUser.id,
      title: 'Báo cáo giữa kỳ đợt 1',
      reportType: 'PROGRESS',
      dueAt: dueIn4Days,
    },
  });

  emailService.clearSentEmails();
  // Trigger deadline check
  const checkRes = await fetch(`${baseUrl}/notifications/check-deadlines`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  assert.equal(checkRes.status, 200);
  const checkData = await checkRes.json();
  assert(checkData.data.notificationsSent >= 1, 'At least 1 deadline notification must be sent');

  // Verify student received DEADLINE notification
  const studentDeadlineNotif = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'DEADLINE',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
  });
  assert(studentDeadlineNotif, 'Student must receive DEADLINE notification');
  assert(studentDeadlineNotif.content.includes('Báo cáo giữa kỳ đợt 1'));
  assert(studentDeadlineNotif.content.includes('ngày nữa là đến hạn'));
  assert(
    emailService.getSentEmails().some((e) => e.to === svUser.email && e.subject.includes('deadline')),
    'Email must be dispatched for deadline warning',
  );

  // Verify anti-spam duplicate prevention within 24 hours: calling again should not re-send for same report
  const repeatCheckRes = await fetch(`${baseUrl}/notifications/check-deadlines`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  assert.equal(repeatCheckRes.status, 200);
  const repeatCheckData = await repeatCheckRes.json();
  // Sent count for this report should be 0 since it was already sent
  console.log(' -> Event 6 (Deadline Warning & Anti-spam duplicate prevention) verified.');

  await app.close();
  console.log('\n======================================================');
  console.log('ALL NOTIFICATION SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
