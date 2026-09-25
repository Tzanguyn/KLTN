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

  console.log(`Running submissions & feedback integration tests on port ${port}...`);

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

  console.log(`Using test Group ID: ${group.id}, Topic: ${group.topic?.title}`);

  // Ensure topic owner is GV
  if (group.topic && group.topic.ownerId !== gvUser.id) {
    await prisma.topic.update({
      where: { id: group.topic.id },
      data: { ownerId: gvUser.id },
    });
  }

  // 2. Student creates a submission
  console.log('Step 2: Student creates submission...');
  const subRes = await fetch(`${baseUrl}/submissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${svToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      groupId: group.id,
      type: 'BAO_CAO_TIEN_DO',
      link: 'https://github.com/example/thesis-submission',
      note: 'Báo cáo tiến độ tuần 4',
    }),
  });
  const subJson = await subRes.json();
  assert.equal(subRes.status, 201, `Submit failed: ${JSON.stringify(subJson)}`);
  const submissionId = subJson.data.id;
  assert(submissionId, 'Submission ID must be returned');
  assert.equal(subJson.data.status, 'CHUA_XEM', 'Initial status must be CHUA_XEM');

  // 3. Lecturer GET /submissions with filters
  console.log('Step 3: Lecturer lists submissions via GET /submissions...');
  const listRes = await fetch(`${baseUrl}/submissions`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  const listJson = await listRes.json();
  assert.equal(listRes.status, 200);
  assert(Array.isArray(listJson.data), 'Returns an array of submissions');
  assert(listJson.data.some((s: any) => s.id === submissionId), 'Must include created submission');

  // 4. Test filter by groupId
  console.log('Step 4: Filter by groupId...');
  const groupFilterRes = await fetch(`${baseUrl}/submissions?groupId=${group.id}`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  const groupFilterJson = await groupFilterRes.json();
  assert.equal(groupFilterRes.status, 200);
  assert(groupFilterJson.data.every((s: any) => s.groupId === group.id));

  // 5. Test filter by date range
  console.log('Step 5: Filter by date range...');
  const today = new Date().toISOString().split('T')[0];
  const dateFilterRes = await fetch(`${baseUrl}/submissions?startDate=${today}&endDate=${today}`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  const dateFilterJson = await dateFilterRes.json();
  assert.equal(dateFilterRes.status, 200);
  assert(dateFilterJson.data.some((s: any) => s.id === submissionId));

  // 6. Test GET /groups/:id/submissions
  console.log('Step 6: GET /groups/:id/submissions...');
  const gSubRes = await fetch(`${baseUrl}/groups/${group.id}/submissions`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  const gSubJson = await gSubRes.json();
  assert.equal(gSubRes.status, 200);
  assert(Array.isArray(gSubJson.data));
  assert(gSubJson.data.some((s: any) => s.id === submissionId));

  // 7. Test GET /submissions/:id (detail info and download/redirect)
  console.log('Step 7a: GET /submissions/:id?info=true...');
  const detailRes = await fetch(`${baseUrl}/submissions/${submissionId}?info=true`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  const detailJson = await detailRes.json();
  assert.equal(detailRes.status, 200);
  assert.equal(detailJson.data.id, submissionId);

  console.log('Step 7b: GET /submissions/:id redirect for link submission...');
  const redirRes = await fetch(`${baseUrl}/submissions/${submissionId}`, {
    headers: { Authorization: `Bearer ${gvToken}` },
    redirect: 'manual',
  });
  assert([301, 302].includes(redirRes.status), 'Link submission must redirect');
  assert.equal(redirRes.headers.get('location'), 'https://github.com/example/thesis-submission');

  console.log('Step 7c: GET /submissions/:id download file...');
  const fs = require('fs');
  const path = require('path');
  const testFileContent = 'Mock PDF thesis report content';
  const testFilePath = path.join(process.cwd(), 'uploads', 'test-thesis.pdf');
  fs.writeFileSync(testFilePath, testFileContent);

  const fileSub = await prisma.submission.create({
    data: {
      groupId: group.id,
      submittedBy: svUser.id,
      fileName: 'BaoCaoTienDo_Final.pdf',
      fileUrl: 'uploads/test-thesis.pdf',
      status: 'CHUA_XEM',
      version: 2,
    },
  });

  const fileDownloadRes = await fetch(`${baseUrl}/submissions/${fileSub.id}`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  assert.equal(fileDownloadRes.status, 200);
  const contentDisp = fileDownloadRes.headers.get('content-disposition');
  assert(contentDisp && contentDisp.includes('BaoCaoTienDo_Final.pdf'), 'Must set attachment filename');
  const downloadedText = await fileDownloadRes.text();
  assert.equal(downloadedText, testFileContent, 'File content must match');
  console.log(' -> File download verified successfully.');

  // 8. Test POST /submissions/:id/feedback with yeuCauChinhSua = true
  console.log('Step 8: Lecturer sends feedback with yeuCauChinhSua = true...');
  emailService.clearSentEmails();
  const fbRes1 = await fetch(`${baseUrl}/submissions/${submissionId}/feedback`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: 'Cần vẽ lại biểu đồ luồng dữ liệu (DFD) và cập nhật thiết kế CSDL.',
      yeuCauChinhSua: true,
    }),
  });
  const fbJson1 = await fbRes1.json();
  assert.equal(fbRes1.status, 201, `Feedback failed: ${JSON.stringify(fbJson1)}`);

  // Verify submission status changed to REVISION_REQUIRED
  const subDb1 = await prisma.submission.findUnique({ where: { id: submissionId } });
  assert.equal(subDb1?.status, 'REVISION_REQUIRED', 'Status must be REVISION_REQUIRED');

  // Verify student received notification
  const notif1 = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'FEEDBACK',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(notif1, 'Student must receive FEEDBACK notification');
  assert(notif1.title.includes('Yêu cầu chỉnh sửa'), 'Title must indicate revision request');
  console.log(' -> Feedback with yeuCauChinhSua=true verified successfully.');

  // 9. Test POST /submissions/:id/feedback with yeuCauChinhSua = false (approval)
  console.log('Step 9: Lecturer sends feedback with yeuCauChinhSua = false...');
  const fbRes2 = await fetch(`${baseUrl}/submissions/${submissionId}/feedback`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: 'Bài nộp đã hoàn thiện tốt, đồng ý thông qua.',
      yeuCauChinhSua: false,
    }),
  });
  const fbJson2 = await fbRes2.json();
  assert.equal(fbRes2.status, 201);

  // Verify submission status changed to ACCEPTED
  const subDb2 = await prisma.submission.findUnique({ where: { id: submissionId } });
  assert.equal(subDb2?.status, 'ACCEPTED', 'Status must be ACCEPTED');

  const notif2 = await prisma.notification.findFirst({
    where: {
      userId: svUser.id,
      type: 'FEEDBACK',
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(notif2, 'Student must receive notification');
  assert(notif2.title.includes('đã được duyệt'), 'Title must indicate approval');
  console.log(' -> Feedback with yeuCauChinhSua=false verified successfully.');

  await app.close();
  console.log('All submissions & feedback integration tests passed!');
}

void runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
