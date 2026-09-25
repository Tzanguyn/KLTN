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

  console.log(`Running appointments workflow integration tests on port ${port}...`);

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

  const svUser = await prisma.user.findUnique({
    where: { email: 'sinhvien@kltn.edu.vn' },
    include: { studentProfile: true },
  });
  const gvUser = await prisma.user.findUnique({
    where: { email: 'giangvien@kltn.edu.vn' },
    include: { lecturerProfile: true },
  });
  assert(svUser && gvUser, 'Seeded users must exist');

  // Find active group for student & lecturer
  const groupMember = await prisma.groupMember.findFirst({
    where: { studentId: svUser.studentProfile!.id },
    include: { group: { include: { topic: true } } },
  });
  assert(groupMember, 'Student must belong to a group');
  const group = groupMember.group;

  // 2. Test POST /appointments with Vietnamese payload and studentIds
  console.log('Step 2: Lecturer creates appointment with studentIds and Vietnamese fields...');
  emailService.clearSentEmails();

  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Ngày mai
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000); // 1 tiếng sau

  const createApptRes = await fetch(`${baseUrl}/appointments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      studentIds: [svUser.id],
      hinhThuc: 'ONLINE',
      thoiGianBatDau: startsAt.toISOString(),
      thoiGianKetThuc: endsAt.toISOString(),
      linkMeet: 'https://meet.google.com/kltn-sv-online',
      noiDung: 'Hướng dẫn xây dựng kiến trúc hệ thống và biểu đồ DFD',
    }),
  });

  const createApptJson = await createApptRes.json();
  assert.equal(createApptRes.status, 201, `Create failed: ${JSON.stringify(createApptJson)}`);
  const appt = createApptJson.data;
  assert(appt?.id, 'Appointment ID must be returned');
  assert.equal(appt.mode, 'ONLINE');
  assert.equal(appt.meetingUrl, 'https://meet.google.com/kltn-sv-online');
  assert.equal(appt.status, 'PROPOSED');
  const apptId = appt.id;

  // Verify Student received notification
  const createNotif = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'APPOINTMENT',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(createNotif, 'Student must receive APPOINTMENT notification on create');
  assert(createNotif.title.includes('Lịch hẹn mới'));
  console.log(' -> POST /appointments verified with notification to student.');

  // 3. Test GET /appointments/my for both GV and SV
  console.log('Step 3: Test GET /appointments/my...');
  const gvListRes = await fetch(`${baseUrl}/appointments/my`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  const gvListJson = await gvListRes.json();
  assert.equal(gvListRes.status, 200);
  assert(Array.isArray(gvListJson.data));
  assert(gvListJson.data.some((a: any) => a.id === apptId));

  const svListRes = await fetch(`${baseUrl}/appointments/my?status=PROPOSED`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const svListJson = await svListRes.json();
  assert.equal(svListRes.status, 200);
  assert(Array.isArray(svListJson.data));
  assert(svListJson.data.some((a: any) => a.id === apptId));
  console.log(' -> GET /appointments/my verified for both GV and SV.');

  // 4. Test PATCH /appointments/:id (Update appointment)
  console.log('Step 4: Test PATCH /appointments/:id...');
  const newStartsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const newEndsAt = new Date(newStartsAt.getTime() + 90 * 60 * 1000);

  const patchRes = await fetch(`${baseUrl}/appointments/${apptId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${gvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      noiDung: 'Hướng dẫn hoàn thiện kiến trúc & DFD (Đổi sang trực tiếp)',
      hinhThuc: 'OFFLINE',
      phong: 'Phòng Bộ môn CNTT - A1.203',
      thoiGianBatDau: newStartsAt.toISOString(),
      thoiGianKetThuc: newEndsAt.toISOString(),
    }),
  });

  const patchJson = await patchRes.json();
  assert.equal(patchRes.status, 200, `Patch failed: ${JSON.stringify(patchJson)}`);
  assert.equal(patchJson.data.mode, 'OFFLINE');
  assert.equal(patchJson.data.location, 'Phòng Bộ môn CNTT - A1.203');

  // Verify Student received update notification
  const updateNotif = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'APPOINTMENT',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(updateNotif, 'Student must receive notification on appointment update');
  assert(updateNotif.title.includes('cập nhật'));
  console.log(' -> PATCH /appointments/:id verified with notification to student.');

  // 5. Test POST /appointments/:id/remind
  console.log('Step 5: Test POST /appointments/:id/remind...');
  const remindRes = await fetch(`${baseUrl}/appointments/${apptId}/remind`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gvToken}`,
    },
  });
  const remindJson = await remindRes.json();
  assert.equal(remindRes.status, 200, `Remind failed: ${JSON.stringify(remindJson)}`);

  const remindNotif = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'APPOINTMENT',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(remindNotif, 'Student must receive reminder notification');
  assert(remindNotif.title.includes('Nhắc nhở'));
  console.log(' -> POST /appointments/:id/remind verified with notification to student.');

  // 6. Test DELETE /appointments/:id (Cancel appointment)
  console.log('Step 6: Test DELETE /appointments/:id...');
  const cancelRes = await fetch(`${baseUrl}/appointments/${apptId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${gvToken}`,
    },
  });
  const cancelJson = await cancelRes.json();
  assert.equal(cancelRes.status, 200, `Cancel failed: ${JSON.stringify(cancelJson)}`);

  // Verify status is CANCELLED
  const apptInDb = await prisma.appointment.findUnique({ where: { id: apptId } });
  assert.equal(apptInDb?.status, 'CANCELLED');

  const cancelNotif = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'APPOINTMENT',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(cancelNotif, 'Student must receive cancellation notification');
  assert(cancelNotif.title.includes('hủy'));
  console.log(' -> DELETE /appointments/:id verified with notification to student.');

  await app.close();
  console.log('All appointments workflow integration tests passed!');
}

void runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

