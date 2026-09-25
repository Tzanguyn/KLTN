import 'reflect-metadata';
import 'dotenv/config';
import * as assert from 'node:assert';
import * as bcrypt from 'bcrypt';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();
  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  console.log(`Running full workflow integration test on port ${port}...`);

  const prisma = app.get(PrismaService);

  // Pre-cleanup test topics and student registrations for test idempotency
  const testUsersToClean = await prisma.user.findMany({
    where: { email: { startsWith: 'test_sv_' } },
    include: { studentProfile: true },
  });
  for (const tu of testUsersToClean) {
    await prisma.submission.deleteMany({ where: { submittedBy: tu.id } });
    if (tu.studentProfile) {
      await prisma.registration.deleteMany({ where: { studentId: tu.studentProfile.id } });
      await prisma.groupMember.deleteMany({ where: { studentId: tu.studentProfile.id } });
      await prisma.topicProposal.deleteMany({ where: { studentId: tu.studentProfile.id } });
    }
    await prisma.notification.deleteMany({ where: { userId: tu.id } });
  }

  const testTopicsToClean = await prisma.topic.findMany({
    where: {
      title: {
        in: [
          'Đề tài 1 sinh viên duy nhất',
          'Hệ thống Quản lý Năng lượng Tòa nhà Xanh ứng dụng AI Edge',
        ],
      },
    },
  });
  for (const tt of testTopicsToClean) {
    await prisma.submission.deleteMany({ where: { group: { topicId: tt.id } } });
    await prisma.registration.deleteMany({ where: { topicId: tt.id } });
    await prisma.groupMember.deleteMany({ where: { group: { topicId: tt.id } } });
    await prisma.group.deleteMany({ where: { topicId: tt.id } });
    await prisma.topic.delete({ where: { id: tt.id } });
  }

  // Ensure active semester registration window is open
  await prisma.semester.updateMany({
    where: { status: 'OPEN' },
    data: {
      registrationFrom: new Date(Date.now() - 1000 * 60 * 60 * 24),
      registrationTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

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

  // 1. Test logins for all 4 roles + Login Use Case specifications
  console.log('1. Testing authentication & Login Use Case specifications...');

  // Test 1a: Valid student login with email
  const svRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'sinhvien@kltn.edu.vn', password: 'Password@123' }),
  });
  const svJson = await svRes.json();
  assert.equal(svRes.status, 201, `Expected 201 but got: ${JSON.stringify(svJson)}`);
  assert(svJson.accessToken, 'accessToken must be present');
  assert(svJson.refreshToken, 'refreshToken must be present');
  assert.equal(svJson.user.email, 'sinhvien@kltn.edu.vn');
  assert.equal(svJson.user.mssv, 'SV2026001');
  assert.equal(svJson.user.role, 'SINH_VIEN');
  assert.equal(svJson.user.duDieuKienDangKyKLTN, true, 'Student SV2026001 must be eligible for KLTN');
  assert(typeof svJson.user.trangThaiKLTN === 'string', 'trangThaiKLTN must be a string');
  const svToken = svJson.accessToken;

  // Test 1b: Valid login with MSSV directly
  const mssvRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'SV2026001', password: 'Password@123' }),
  });
  assert.equal(mssvRes.status, 201, 'Login with MSSV must succeed');

  // Test 1c: Ineligible student login (SV2026002)
  const ineligRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'SV2026002', password: 'Password@123' }),
  });
  const ineligJson = await ineligRes.json();
  assert.equal(ineligRes.status, 201, 'Ineligible student still logs in successfully');
  assert.equal(ineligJson.user.duDieuKienDangKyKLTN, false, 'duDieuKienDangKyKLTN must be false');
  assert.equal(ineligJson.user.trangThaiKLTN, 'CHUA_DU_DIEU_KIEN', 'trangThaiKLTN must be CHUA_DU_DIEU_KIEN');
  const sv2Token = ineligJson.accessToken;

  // Test 1d: Other roles login
  const gvToken = await login('giangvien@kltn.edu.vn');
  const tbmToken = await login('truongbomon@kltn.edu.vn');
  const qlToken = await login('quanly@kltn.edu.vn');
  assert(gvToken && tbmToken && qlToken);
  console.log(' -> Valid logins (Email & MSSV) & eligibility checks verified.');

  // Test 1e: Exception E1 - Wrong credentials returns 401
  console.log('Testing Exception E1: Invalid credentials & Rate limiting...');
  const wrongRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'wrong_account@kltn.edu.vn', password: 'Password@123' }),
  });
  const wrongJson = await wrongRes.json();
  assert.equal(wrongRes.status, 401, 'Wrong credentials must return 401');
  assert.equal(wrongJson.message, 'MSSV/email hoặc mật khẩu không chính xác');

  // Test 1f: Exception E1 - Rate limit after 5 failed attempts
  const testLimitId = 'rate_limit_test@kltn.edu.vn';
  for (let i = 0; i < 4; i++) {
    await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testLimitId, password: 'WrongPassword' }),
    });
  }
  await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testLimitId, password: 'WrongPassword' }),
  });
  const sixthAttempt = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testLimitId, password: 'WrongPassword' }),
  });
  assert.equal(sixthAttempt.status, 429, '6th attempt must be rejected with 429 Too Many Requests');
  console.log(' -> Exception E1 verified (401 message + 429 rate limit).');

  // Test 1g: Exception E2 - Locked account returns 403
  console.log('Testing Exception E2: Locked account...');
  const lockedRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'khoataikhoan@kltn.edu.vn', password: 'Password@123' }),
  });
  const lockedJson = await lockedRes.json();
  assert.equal(lockedRes.status, 403, 'Locked account must return 403');
  assert.equal(lockedJson.message, 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
  console.log(' -> Exception E2 verified (403 Forbidden with administrator contact instruction).');

  // 2. Test RBAC: Student cannot review topics
  console.log('2. Testing RBAC restrictions...');
  const rbacRes = await fetch(`${baseUrl}/topics/00000000-0000-0000-0000-000000000001/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svToken}` },
    body: JSON.stringify({ approved: true }),
  });
  assert.equal(rbacRes.status, 403, 'Student must be forbidden from reviewing topics');
  console.log(' -> RBAC guard properly rejected unauthorized student call with 403.');

  // 3. Test Student eligibility
  console.log('3. Testing student eligibility check...');
  const eligRes = await fetch(`${baseUrl}/users/me/eligibility`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const eligData = await eligRes.json();
  assert.equal(eligRes.status, 200);
  assert.equal(eligData.data.eligible, true, 'Seeded student must be eligible');
  console.log(' -> Student eligibility verified: true');

  // 4. Test Lecturer workload report
  console.log('4. Testing lecturer workload reporting...');
  const wlRes = await fetch(`${baseUrl}/reports/workload`, {
    headers: { Authorization: `Bearer ${tbmToken}` },
  });
  const wlData = await wlRes.json();
  assert.equal(wlRes.status, 200);
  assert(Array.isArray(wlData.data), 'Workload data must be an array');
  assert(wlData.data.length > 0, 'Workload data must contain lecturers');
  console.log(` -> Workload report returned ${wlData.data.length} lecturers.`);

  // 5. Test Reviewer assignment conflict prevention (GVHD cannot review own group)
  console.log('5. Testing reviewer conflict prevention...');
  // Get existing group
  const grpRes = await fetch(`${baseUrl}/groups/mine`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  const grpData = await grpRes.json();
  if (grpData.data.length > 0) {
    const group = grpData.data[0];
    // Find lecturer profile ID of GVHD
    const lecRes = await fetch(`${baseUrl}/users/lecturers`, {
      headers: { Authorization: `Bearer ${tbmToken}` },
    });
    const lecData = await lecRes.json();
    const gvhdProfile = lecData.data.find((l: any) => l.user.email === 'giangvien@kltn.edu.vn');
    if (gvhdProfile) {
      const conflictRes = await fetch(`${baseUrl}/defense/reviewers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
        body: JSON.stringify({ groupId: group.id, lecturerId: gvhdProfile.id }),
      });
      assert.equal(conflictRes.status, 400, 'Assigning GVHD as reviewer must return 400 Bad Request');
      console.log(' -> Conflict prevention verified: GVHD successfully blocked from reviewing own group.');
    }
  }

  // 6. Test Excel export
  console.log('6. Testing Excel export endpoint...');
  const xlsxRes = await fetch(`${baseUrl}/reports/registrations.xlsx`, {
    headers: { Authorization: `Bearer ${tbmToken}` },
  });
  if (xlsxRes.status !== 200) {
    console.error('Excel export error:', xlsxRes.status, await xlsxRes.text());
  }
  assert.equal(xlsxRes.status, 200);
  assert.equal(
    xlsxRes.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  console.log(' -> Excel registration report export verified.');

  // 7. Test Forgot Password and Reset Password flow
  console.log('7. Testing password reset flow...');
  const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sinhvien2@kltn.edu.vn' }),
  });
  const forgotData = await forgotRes.json();
  assert.equal(forgotRes.status, 201);
  const resetToken = forgotData.data?.resetToken ?? forgotData.resetToken;
  assert(resetToken, 'In development mode, resetToken must be returned');

  const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: resetToken, newPassword: 'NewPassword@123' }),
  });
  assert.equal(resetRes.status, 201);

  // Verify new password works
  const newLoginToken = await login('sinhvien2@kltn.edu.vn', 'NewPassword@123');
  assert(newLoginToken, 'Login with new password must succeed');
  // Revert password
  const revertForgot = await fetch(`${baseUrl}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sinhvien2@kltn.edu.vn' }),
  }).then((r) => r.json());
  const revertToken = revertForgot.data?.resetToken ?? revertForgot.resetToken;
  await fetch(`${baseUrl}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: revertToken, newPassword: 'Password@123' }),
  });
  console.log(' -> Password reset flow verified.');

  // 8. Test Student Profile Update Use Case (GET /students/me & PUT /students/me)
  console.log('8. Testing Student Profile Update Use Case...');

  // 8a: GET /students/me with student token
  const profileGetRes = await fetch(`${baseUrl}/students/me`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const profileGetData = await profileGetRes.json();
  assert.equal(profileGetRes.status, 200, 'GET /students/me must return 200');
  const studentProfile = profileGetData.data;
  assert.equal(studentProfile.emailTruong, 'sinhvien@kltn.edu.vn');
  assert.equal(studentProfile.mssv, 'SV2026001');
  assert.equal(studentProfile.duDieuKienDangKyKLTN, true);

  // 8b: RBAC check - Lecturer cannot access /students/me
  const lecturerForbiddenRes = await fetch(`${baseUrl}/students/me`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  assert.equal(lecturerForbiddenRes.status, 403, 'Non-student cannot access /students/me');

  // 8c: Validation check - Invalid phone number (must be 10 digits starting with 0)
  const invalidPhoneRes = await fetch(`${baseUrl}/students/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svToken}` },
    body: JSON.stringify({ soDienThoai: '1234567890' }), // does not start with 0
  });
  assert.equal(invalidPhoneRes.status, 400, 'Invalid phone number must return 400');

  const invalidPhoneRes2 = await fetch(`${baseUrl}/students/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svToken}` },
    body: JSON.stringify({ soDienThoai: '098765432' }), // 9 digits
  });
  assert.equal(invalidPhoneRes2.status, 400, '9-digit phone must return 400');

  // 8d: Validation check - Invalid email format
  const invalidEmailRes = await fetch(`${baseUrl}/students/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svToken}` },
    body: JSON.stringify({ emailCaNhan: 'not-an-email-address' }),
  });
  assert.equal(invalidEmailRes.status, 400, 'Invalid personal email format must return 400');

  // 8e: Security check - Disallowed fields (studentCode, gpa, fullName) must be rejected
  const forbiddenFieldRes = await fetch(`${baseUrl}/students/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svToken}` },
    body: JSON.stringify({ studentCode: 'HACKED_MSSV', gpa: 4.0 }),
  });
  assert.equal(forbiddenFieldRes.status, 400, 'Attempting to modify read-only academic fields must return 400');

  // 8f: Valid profile update
  const updatedPayload = {
    soDienThoai: '0987654321',
    emailCaNhan: 'nguyenvana.personal@gmail.com',
    diaChi: '123 Đường 3/2, Phường 11, Quận 10, TP. Hồ Chí Minh',
    thongTinKhac: 'Zalo: 0987654321 (liên hệ ngoài giờ hành chính)',
  };
  const updateRes = await fetch(`${baseUrl}/students/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svToken}` },
    body: JSON.stringify(updatedPayload),
  });
  const updateData = await updateRes.json();
  assert.equal(updateRes.status, 200, 'Valid update must return 200');
  assert.equal(updateData.data.soDienThoai, updatedPayload.soDienThoai);
  assert.equal(updateData.data.emailCaNhan, updatedPayload.emailCaNhan);
  assert.equal(updateData.data.diaChi, updatedPayload.diaChi);
  assert.equal(updateData.data.thongTinKhac, updatedPayload.thongTinKhac);
  // Ensure immutable fields are preserved
  assert.equal(updateData.data.mssv, 'SV2026001');
  assert.equal(updateData.data.emailTruong, 'sinhvien@kltn.edu.vn');

  // 8g: GET /students/me to verify persistence
  const reGetRes = await fetch(`${baseUrl}/students/me`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const reGetData = await reGetRes.json();
  assert.equal(reGetData.data.soDienThoai, updatedPayload.soDienThoai);
  assert.equal(reGetData.data.emailCaNhan, updatedPayload.emailCaNhan);
  assert.equal(reGetData.data.diaChi, updatedPayload.diaChi);
  assert.equal(reGetData.data.thongTinKhac, updatedPayload.thongTinKhac);

  // 8h: Verify AuditLog entry in database
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: 'UPDATE_STUDENT_PROFILE',
      entity: 'StudentProfile',
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  assert(auditLogs.length > 0, 'AuditLog entry must be created on profile update');
  const latestLog = auditLogs[0];
  assert.equal(latestLog.action, 'UPDATE_STUDENT_PROFILE');
  const meta = latestLog.metadata as any;
  assert(meta?.updated, 'AuditLog metadata must contain updated values');
  assert.equal(meta.updated.phone, updatedPayload.soDienThoai);
  assert.equal(meta.updated.personalEmail, updatedPayload.emailCaNhan);

  console.log(' -> Student Profile Update Use Case successfully verified (GET, PUT, validations, forbidden field guard, persistence & AuditLog).');

  // 9. Test Use Case "Xem hồ sơ KLTN của mình" (GET /students/me/kltn-profile)
  console.log('9. Testing Use Case "Xem hồ sơ KLTN của mình"...');

  // 9a: Exception - Student without topic (SV2026002)
  const noTopicRes = await fetch(`${baseUrl}/students/me/kltn-profile`, {
    headers: { Authorization: `Bearer ${sv2Token}` },
  });
  const noTopicData = await noTopicRes.json();
  assert.equal(noTopicRes.status, 200, 'GET /students/me/kltn-profile must return 200');
  assert.equal(noTopicData.data.hasDeTai, false, 'hasDeTai must be false when student has no topic');
  assert.equal(
    noTopicData.data.message,
    'Bạn chưa đăng ký hoặc được phân công đề tài nào',
    'Proper message when no topic',
  );
  console.log(' -> Exception case verified: Student without topic gets hasDeTai: false with friendly message.');

  // 9b: RBAC - Non-student (Lecturer) forbidden
  const rbacKltnRes = await fetch(`${baseUrl}/students/me/kltn-profile`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  assert.equal(rbacKltnRes.status, 403, 'Lecturer must be forbidden from accessing student kltn profile');
  console.log(' -> RBAC verified: Lecturer forbidden (403) from /students/me/kltn-profile.');

  // 9c: Main flow - Student with topic (SV2026001)
  const kltnRes = await fetch(`${baseUrl}/students/me/kltn-profile`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const kltnData = await kltnRes.json();
  assert.equal(kltnRes.status, 200, 'GET /students/me/kltn-profile must return 200');
  const kltnProfile = kltnData.data;
  assert.equal(kltnProfile.hasDeTai, true, 'hasDeTai must be true for assigned student');

  // deTai check
  assert(kltnProfile.deTai, 'deTai object must be present');
  assert(kltnProfile.deTai.id, 'deTai.id must be present');
  assert(typeof kltnProfile.deTai.tenDeTai === 'string', 'deTai.tenDeTai must be string');
  assert(typeof kltnProfile.deTai.moTa === 'string', 'deTai.moTa must be string');
  assert.equal(kltnProfile.deTai.trangThai, 'APPROVED', 'deTai.trangThai must be APPROVED');

  // gvhd check
  assert(kltnProfile.gvhd, 'gvhd object must be present');
  assert(kltnProfile.gvhd.id, 'gvhd.id must be present');
  assert(typeof kltnProfile.gvhd.hoTen === 'string', 'gvhd.hoTen must be string');
  assert.equal(kltnProfile.gvhd.email, 'giangvien@kltn.edu.vn', 'gvhd.email must match');
  assert(typeof kltnProfile.gvhd.soDienThoai === 'string', 'gvhd.soDienThoai must be string');

  // thanhVienNhom check
  assert(Array.isArray(kltnProfile.thanhVienNhom), 'thanhVienNhom must be an array');
  assert(kltnProfile.thanhVienNhom.length > 0, 'thanhVienNhom must contain members');
  const currentMember = kltnProfile.thanhVienNhom.find((m: any) => m.mssv === 'SV2026001');
  assert(currentMember, 'thanhVienNhom must contain student SV2026001');
  assert.equal(currentMember.vaiTro, 'Trưởng nhóm');

  // lichSuNopBai check
  assert(Array.isArray(kltnProfile.lichSuNopBai), 'lichSuNopBai must be an array');

  // lichSuTraoDoi check
  assert(Array.isArray(kltnProfile.lichSuTraoDoi), 'lichSuTraoDoi must be an array');

  // trangThaiHienTai check
  assert(typeof kltnProfile.trangThaiHienTai === 'string', 'trangThaiHienTai must be enum string');
  console.log(` -> Main flow verified: deTai (${kltnProfile.deTai.tenDeTai}), GVHD (${kltnProfile.gvhd.hoTen}), ${kltnProfile.thanhVienNhom.length} members, current status: ${kltnProfile.trangThaiHienTai}.`);

  // 10. Test Use Case "Xem danh sách đề tài" (đã duyệt + còn chỗ trống)
  console.log('10. Testing Use Case "Xem danh sách đề tài (đã duyệt + còn chỗ trống)"...');

  // 10a: GET /topics?status=APPROVED&hasSlot=true
  const topicsRes = await fetch(`${baseUrl}/topics?status=APPROVED&hasSlot=true`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const topicsData = await topicsRes.json();
  assert.equal(topicsRes.status, 200, 'GET /topics?status=APPROVED&hasSlot=true must return 200');
  const topicList = topicsData.data?.data ?? topicsData.data?.items ?? topicsData.data;
  assert(Array.isArray(topicList), 'Topic list must be an array');
  assert(topicList.length > 0, 'Must have at least 1 approved topic with available slots');

  const sampleTopic = topicList[0];
  assert(sampleTopic.id, 'Topic must have id');
  assert(typeof sampleTopic.tenDeTai === 'string', 'Topic must have tenDeTai');
  assert(typeof sampleTopic.moTa === 'string', 'Topic must have moTa');
  assert(typeof sampleTopic.yeuCau === 'string', 'Topic must have yeuCau');
  assert(typeof sampleTopic.soLuongToiDa === 'number', 'Topic must have soLuongToiDa');
  assert(typeof sampleTopic.soLuongDaDangKy === 'number', 'Topic must have soLuongDaDangKy');
  assert(typeof sampleTopic.soChoConLai === 'number', 'Topic must have soChoConLai');
  assert(sampleTopic.soChoConLai > 0, 'Every topic returned with hasSlot=true must have soChoConLai > 0');
  assert.equal(sampleTopic.conCho, true, 'conCho must be true');
  assert(sampleTopic.gvhd, 'Topic must have gvhd');
  assert(typeof sampleTopic.gvhd.hoTen === 'string', 'gvhd.hoTen must be string');
  assert(typeof sampleTopic.gvhd.email === 'string', 'gvhd.email must be string');
  assert.equal(sampleTopic.trangThaiDangKy, 'CON_CHO');

  // Check meta object
  const topicsMeta = topicsData.data?.meta;
  assert(topicsMeta, 'Response must include meta object');
  assert.equal(topicsMeta.page, 1);
  assert(topicsMeta.total >= 1);
  assert.equal(typeof topicsMeta.registrationOpen, 'boolean', 'meta.registrationOpen must be boolean');
  console.log(` -> Approved & available topics verified (${topicList.length} items found, registrationOpen: ${topicsMeta.registrationOpen}).`);

  // 10b: Filter by keyword
  const keywordRes = await fetch(`${baseUrl}/topics?status=APPROVED&hasSlot=true&keyword=Blockchain`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const keywordData = await keywordRes.json();
  const keywordList = keywordData.data?.data ?? keywordData.data?.items;
  assert(Array.isArray(keywordList), 'Keyword search result must be array');
  assert(
    keywordList.some((t: any) => t.tenDeTai.includes('Blockchain') || t.congNghe?.includes('Blockchain')),
    'Keyword search must return topics containing Blockchain',
  );
  console.log(' -> Keyword search filter verified.');

  // 10c: Filter by GVHD (gvId)
  const gvId = sampleTopic.gvhd.id;
  const gvTopicsRes = await fetch(`${baseUrl}/topics?status=APPROVED&gvId=${gvId}`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const gvTopicsData = await gvTopicsRes.json();
  const gvTopicList = gvTopicsData.data?.data ?? gvTopicsData.data?.items;
  assert(gvTopicList.every((t: any) => t.gvhd.id === gvId), 'All topics must belong to specified GVHD');
  console.log(' -> Lecturer filter (gvId) verified.');

  // 10d: Pagination test
  const pageRes = await fetch(`${baseUrl}/topics?status=APPROVED&page=1&limit=1`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const pageData = await pageRes.json();
  const pageList = pageData.data?.data ?? pageData.data?.items;
  assert.equal(pageList.length, 1, 'Pagination limit=1 must return 1 item');
  assert.equal(pageData.data?.meta?.limit, 1);
  assert.equal(pageData.data?.meta?.page, 1);
  console.log(' -> Pagination (page & limit) verified.');

  // 10e: Exception case - Empty result with friendly message
  const emptyRes = await fetch(`${baseUrl}/topics?keyword=TuKhoaKhongTonTai_XYZ999`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const emptyData = await emptyRes.json();
  const emptyList = emptyData.data?.data ?? emptyData.data?.items;
  assert.equal(emptyList.length, 0, 'Non-matching keyword must return empty list');
  assert.equal(
    emptyData.data?.message,
    'Không tìm thấy đề tài nào phù hợp với bộ lọc',
    'Empty result must provide proper message',
  );
  console.log(' -> Empty result exception case verified with message.');

  // 11. Testing Use Case "Đăng ký đề tài"
  console.log('11. Testing Use Case "Đăng ký đề tài"...');

  // Helper create student
  async function createTestStudent(email: string, studentCode: string, eligible = true, credits = 120) {
    const svRole = await prisma.role.findUnique({ where: { code: 'SINH_VIEN' } });
    const dept = await prisma.department.findFirst();
    const passwordHash = await bcrypt.hash('Password@123', 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, status: 'ACTIVE' },
      create: { email, fullName: `Sinh viên Test ${studentCode}`, passwordHash, status: 'ACTIVE' },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: svRole!.id } },
      update: {},
      create: { userId: user.id, roleId: svRole!.id },
    });
    const profile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: { eligible, creditsEarned: credits },
      create: {
        userId: user.id,
        studentCode,
        className: 'CNTT-TEST',
        cohort: 2026,
        departmentId: dept!.id,
        creditsEarned: credits,
        eligible,
      },
    });

    // Clean up test student state for idempotency across test runs
    await prisma.submission.deleteMany({ where: { submittedBy: user.id } });
    await prisma.registration.deleteMany({ where: { studentId: profile.id } });
    await prisma.groupMember.deleteMany({ where: { studentId: profile.id } });
    await prisma.topicProposal.deleteMany({ where: { studentId: profile.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });

    return { user, profile };
  }

  // 11a: Exception E3: Ineligible student (SV2026002) cannot register
  const ineligRegRes = await fetch(`${baseUrl}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sv2Token}` },
    body: JSON.stringify({ topicId: sampleTopic.id }),
  });
  const ineligRegData = await ineligRegRes.json();
  assert.equal(ineligRegRes.status, 403, `Ineligible student must receive 403 Forbidden but got ${ineligRegRes.status}: ${JSON.stringify(ineligRegData)}`);
  assert(
    ineligRegData.message.includes('chưa đủ điều kiện') || ineligRegData.message.includes('không đủ điều kiện'),
    `Error message must indicate ineligibility but got: ${ineligRegData.message}`,
  );
  console.log(' -> Exception E3 (403 Ineligible student) verified.');

  // 11b: Exception E2: Student already assigned to topic/group (SV2026001) cannot register
  const dupRegRes = await fetch(`${baseUrl}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svToken}` },
    body: JSON.stringify({ topicId: sampleTopic.id }),
  });
  const dupRegData = await dupRegRes.json();
  assert.equal(dupRegRes.status, 409, 'Student already having topic must receive 409 Conflict');
  assert.equal(dupRegData.message, 'Bạn đã đăng ký hoặc thuộc một đề tài khác');
  console.log(' -> Exception E2 (409 Student already having topic) verified.');

  // 11c: Main flow: Fresh eligible student registers for available topic
  await createTestStudent('test_sv_reg1@kltn.edu.vn', 'SV_REG_001', true, 125);
  const svReg1Token = await login('test_sv_reg1@kltn.edu.vn');
  const regRes = await fetch(`${baseUrl}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svReg1Token}` },
    body: JSON.stringify({ topicId: sampleTopic.id }),
  });
  const regData = await regRes.json();
  assert.equal(regRes.status, 201, 'Eligible student registering available topic must return 201 Created');
  assert.equal(regData.data.status, 'CHO_XAC_NHAN', 'Registration initial status must be CHO_XAC_NHAN');
  assert.equal(regData.data.topicId, sampleTopic.id);

  // Check student received notification
  const studentNotifs = await prisma.notification.findMany({
    where: { userId: regData.data.student.userId },
  });
  assert(studentNotifs.some((n: any) => n.title.includes('Đăng ký đề tài')), 'Student must receive confirmation notification');
  console.log(' -> Main flow (201 Created with status CHO_XAC_NHAN & notifications) verified.');

  // 11d: Exception E2: Student with active registration attempts to register again
  const secondRegRes = await fetch(`${baseUrl}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svReg1Token}` },
    body: JSON.stringify({ topicId: sampleTopic.id }),
  });
  const secondRegData = await secondRegRes.json();
  assert.equal(secondRegRes.status, 409, 'Student with pending registration cannot register again (409)');
  assert.equal(secondRegData.message, 'Bạn đã đăng ký hoặc thuộc một đề tài khác');
  console.log(' -> Exception E2 (409 Student with pending registration attempts second register) verified.');

  // 11e: Exception E1: Topic is full (capacity reached)
  const activeSemester = await prisma.semester.findFirst({ where: { status: 'OPEN' } });
  const singleSlotTopic = await prisma.topic.create({
    data: {
      title: 'Đề tài 1 sinh viên duy nhất',
      summary: 'Đề tài có số lượng tối đa 1 người',
      objectives: 'Hoàn thành đề tài solo',
      capacity: 1,
      status: 'APPROVED',
      ownerId: (await prisma.user.findUnique({ where: { email: 'giangvien@kltn.edu.vn' } }))!.id,
      semesterId: activeSemester!.id,
      departmentId: (await prisma.department.findFirst())!.id,
    },
  });

  // Student 2 registers single slot topic -> success
  await createTestStudent('test_sv_reg2@kltn.edu.vn', 'SV_REG_002', true, 120);
  const svReg2Token = await login('test_sv_reg2@kltn.edu.vn');
  const reg2Res = await fetch(`${baseUrl}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svReg2Token}` },
    body: JSON.stringify({ topicId: singleSlotTopic.id }),
  });
  assert.equal(reg2Res.status, 201);

  // Student 3 attempts to register the now-full topic -> 409 E1
  await createTestStudent('test_sv_reg3@kltn.edu.vn', 'SV_REG_003', true, 120);
  const svReg3Token = await login('test_sv_reg3@kltn.edu.vn');
  const reg3Res = await fetch(`${baseUrl}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svReg3Token}` },
    body: JSON.stringify({ topicId: singleSlotTopic.id }),
  });
  const reg3Data = await reg3Res.json();
  assert.equal(reg3Res.status, 409, 'Registering full topic must return 409 Conflict');
  assert.equal(reg3Data.message, 'Đề tài đã đủ số lượng sinh viên');
  console.log(' -> Exception E1 (409 Topic full capacity) verified.');

  // 12. Testing Use Case "Đề xuất đề tài" (SV đã liên hệ trước với GV)
  console.log('12. Testing Use Case "Đề xuất đề tài (SV đã liên hệ trước với GV)"...');

  // Setup Student 4 for topic proposal
  await createTestStudent('test_sv_prop@kltn.edu.vn', 'SV_PROP_001', true, 125);
  const svPropToken = await login('test_sv_prop@kltn.edu.vn');
  const lecturerUser = await prisma.user.findUnique({
    where: { email: 'giangvien@kltn.edu.vn' },
    include: { lecturerProfile: true },
  });
  const lecturerProfileId = lecturerUser!.lecturerProfile!.id;

  // 12a: Exception: Missing required fields -> 400 Bad Request
  const missingFieldRes = await fetch(`${baseUrl}/topic-proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svPropToken}` },
    body: JSON.stringify({ moTa: 'Thieu ten de tai va gvhd' }),
  });
  assert.equal(missingFieldRes.status, 400, 'Missing fields must return 400 Bad Request');
  console.log(' -> Exception (400 Missing required fields) verified.');

  // 12b: Main flow: Student submits proposal
  const propRes = await fetch(`${baseUrl}/topic-proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svPropToken}` },
    body: JSON.stringify({
      tenDeTai: 'Hệ thống Quản lý Năng lượng Thông minh IoT',
      moTa: 'Tự động giám sát và tối ưu hóa tiêu thụ điện',
      yeuCau: 'Kiến trúc vi dịch vụ, React, ESP32, MQTT',
      gvhdId: lecturerProfileId,
    }),
  });
  const propData = await propRes.json();
  assert.equal(propRes.status, 201, 'POST /topic-proposals must return 201 Created');
  assert.equal(propData.data.status, 'CHO_GV_XAC_NHAN', 'Proposal initial status must be CHO_GV_XAC_NHAN');
  assert.equal(propData.data.tenDeTai, 'Hệ thống Quản lý Năng lượng Thông minh IoT');
  const proposalId = propData.data.id;
  console.log(' -> Main flow (201 Created with status CHO_GV_XAC_NHAN) verified.');

  // 12c: Student views their proposals via GET /topic-proposals/me
  const myPropRes = await fetch(`${baseUrl}/topic-proposals/me`, {
    headers: { Authorization: `Bearer ${svPropToken}` },
  });
  const myPropData = await myPropRes.json();
  assert.equal(myPropRes.status, 200, 'GET /topic-proposals/me must return 200');
  const myProposalsList = myPropData.data?.data ?? myPropData.data;
  assert(Array.isArray(myProposalsList), 'My proposals must be array');
  assert(myProposalsList.some((p: any) => p.id === proposalId), 'Created proposal must be in my list');
  console.log(` -> GET /topic-proposals/me verified (${myProposalsList.length} items found).`);

  // 12d: Lecturer views proposals sent to them via GET /topic-proposals/lecturer
  const lecPropRes = await fetch(`${baseUrl}/topic-proposals/lecturer`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  const lecPropData = await lecPropRes.json();
  assert.equal(lecPropRes.status, 200, 'GET /topic-proposals/lecturer must return 200');
  const lecProposalsList = lecPropData.data?.data ?? lecPropData.data;
  assert(Array.isArray(lecProposalsList), 'Lecturer proposals must be array');
  assert(lecProposalsList.some((p: any) => p.id === proposalId), 'Created proposal must be visible to lecturer');
  console.log(` -> GET /topic-proposals/lecturer verified (${lecProposalsList.length} items found).`);

  // 12e: Alternate flow: Lecturer rejects proposal with reason
  const rejectRes = await fetch(`${baseUrl}/topic-proposals/${proposalId}/decision`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvToken}` },
    body: JSON.stringify({
      status: 'TU_CHOI',
      reason: 'Đề tài trùng lặp với đề tài khóa trước, cần chỉnh sửa lại phạm vi',
    }),
  });
  const rejectData = await rejectRes.json();
  assert.equal(rejectRes.status, 200, 'PATCH /topic-proposals/:id/decision (TU_CHOI) must return 200');
  assert.equal(rejectData.data.proposal.status, 'TU_CHOI');
  assert.equal(rejectData.data.proposal.rejectionReason, 'Đề tài trùng lặp với đề tài khóa trước, cần chỉnh sửa lại phạm vi');
  console.log(' -> Alternate flow (GV từ chối proposal with reason) verified.');

  // 12f: Alternate flow: Student submits revised proposal & Lecturer approves
  const prop2Res = await fetch(`${baseUrl}/topic-proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svPropToken}` },
    body: JSON.stringify({
      tenDeTai: 'Hệ thống Quản lý Năng lượng Tòa nhà Xanh ứng dụng AI Edge',
      moTa: 'Ứng dụng mô hình AI phân tích dữ liệu cảm biến thời gian thực',
      yeuCau: 'Python, PyTorch, React, NestJS, Docker',
      gvhdId: lecturerProfileId,
    }),
  });
  const prop2Data = await prop2Res.json();
  assert.equal(prop2Res.status, 201);
  const proposal2Id = prop2Data.data.id;

  const approveRes = await fetch(`${baseUrl}/topic-proposals/${proposal2Id}/decision`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvToken}` },
    body: JSON.stringify({ status: 'GV_DA_DUYET' }),
  });
  const approveData = await approveRes.json();
  assert.equal(approveRes.status, 200, 'PATCH /topic-proposals/:id/decision (GV_DA_DUYET) must return 200');
  assert.equal(approveData.data.proposal.status, 'GV_DA_DUYET');
  assert(approveData.data.topic, 'Topic must be created automatically');
  assert.equal(approveData.data.topic.title, 'Hệ thống Quản lý Năng lượng Tòa nhà Xanh ứng dụng AI Edge');
  assert.equal(approveData.data.topic.status, 'APPROVED');

  // Verify that an approved registration was automatically created for this student
  const studentRegs = await prisma.registration.findMany({
    where: { topicId: approveData.data.topic.id },
  });
  assert(studentRegs.some((r: any) => r.status === 'APPROVED'), 'Student must have an APPROVED registration for the created topic');
  console.log(' -> Alternate flow (GV đồng ý proposal -> auto create Topic & Registration APPROVED) verified.');

  // ==========================================
  // 13. TESTING USE CASE "HỦY / RÚT ĐĂNG KÝ"
  // ==========================================
  console.log('13. Testing Use Case "Hủy / Rút đăng ký đề tài KLTN"...');

  // Setup a student with an active registration
  await createTestStudent('test_sv_cancel@kltn.edu.vn', 'SV_CANCEL_01', true, 125);
  const svCancelToken = await login('test_sv_cancel@kltn.edu.vn');

  // Student registers topic
  const regToCancelRes = await fetch(`${baseUrl}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svCancelToken}` },
    body: JSON.stringify({ topicId: sampleTopic.id }),
  });
  const regToCancelData = await regToCancelRes.json();
  assert.equal(regToCancelRes.status, 201);
  const regId = regToCancelData.data.id;
  assert.equal(regToCancelData.data.status, 'CHO_XAC_NHAN');

  // 13a. Main Flow: POST /registrations/:id/cancel
  const cancelRes = await fetch(`${baseUrl}/registrations/${regId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svCancelToken}` },
    body: JSON.stringify({ reason: 'Em muốn đổi sang đề tài khác' }),
  });
  const cancelData = await cancelRes.json();
  assert.equal(cancelRes.status, 201, 'POST /registrations/:id/cancel must return 201 Created/Success');
  assert.equal(cancelData.data.status, 'DA_HUY', 'Registration status must be updated to DA_HUY');
  assert(cancelData.data.decisionNote.includes('Em muốn đổi sang đề tài khác'));

  // 13b. Verify slot refund (Chỗ trống được hoàn trả)
  const regAgainRes = await fetch(`${baseUrl}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svCancelToken}` },
    body: JSON.stringify({ topicId: sampleTopic.id }),
  });
  const regAgainData = await regAgainRes.json();
  assert.equal(regAgainRes.status, 201, 'Student must be able to register again after cancelling previous registration');
  const activeRegId = regAgainData.data.id;
  console.log(' -> Main flow & Slot refund verified (status = DA_HUY, slot freed).');

  // 13c. Verify Notification for GVHD
  const gvhdUser = await prisma.user.findUnique({ where: { email: 'giangvien@kltn.edu.vn' } });
  const gvhdNotifs = await prisma.notification.findMany({
    where: { userId: gvhdUser!.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  assert(
    gvhdNotifs.some((n: any) => n.title?.includes('hủy') || n.message?.includes('hủy')),
    'GVHD must receive notification about cancellation',
  );
  console.log(' -> GVHD Notification verified.');

  // 13d. Exception: GV đã xác nhận chính thức -> 403 "Vui lòng liên hệ GVHD/Quản lý"
  const approvedReg = studentRegs.find((r: any) => r.status === 'APPROVED');
  assert(approvedReg, 'Approved registration must exist for test');
  const cancelApprovedRes = await fetch(`${baseUrl}/registrations/${approvedReg.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svPropToken}` },
    body: JSON.stringify({ reason: 'Muốn hủy đề tài đã duyệt' }),
  });
  const cancelApprovedData = await cancelApprovedRes.json();
  assert.equal(cancelApprovedRes.status, 403, 'Cancelling approved registration must return 403 Forbidden');
  assert.equal(
    cancelApprovedData.message,
    'Vui lòng liên hệ GVHD/Quản lý',
    'Message must be "Vui lòng liên hệ GVHD/Quản lý"',
  );
  console.log(' -> Exception: Approved registration cancel rejected (403 "Vui lòng liên hệ GVHD/Quản lý") verified.');

  // 13e. Exception: Quá hạn thời hạn đăng ký -> 403
  // Temporarily close registration deadline
  const currentSem = await prisma.semester.findFirst({ where: { status: 'OPEN' } });
  const originalTo = currentSem?.registrationTo;
  try {
    await prisma.semester.update({
      where: { id: currentSem!.id },
      data: { registrationTo: new Date(Date.now() - 1000 * 60 * 60 * 24) }, // Yesterday
    });

    const expiredCancelRes = await fetch(`${baseUrl}/registrations/${activeRegId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svCancelToken}` },
    });
    assert.equal(expiredCancelRes.status, 403, 'Cancelling after registration deadline must return 403 Forbidden');
  } finally {
    // Restore semester deadline
    await prisma.semester.update({
      where: { id: currentSem!.id },
      data: { registrationTo: originalTo },
    });
  }
  console.log(' -> Exception: Expired deadline cancel rejected (403) verified.');

  // ==========================================
  // 14. TESTING USE CASE "XEM TIẾN ĐỘ & DEADLINE"
  // ==========================================
  console.log('14. Testing Use Case "Xem tiến độ KLTN & Deadline"...');

  const progressRes = await fetch(`${baseUrl}/students/me/progress`, {
    headers: { Authorization: `Bearer ${svPropToken}` },
  });
  const progressData = await progressRes.json();
  assert.equal(progressRes.status, 200, 'GET /students/me/progress must return 200');
  assert(typeof progressData.data.percentComplete === 'number', 'percentComplete must be number');
  assert(progressData.data.percentComplete >= 0 && progressData.data.percentComplete <= 100);
  assert(Array.isArray(progressData.data.deadlines), 'deadlines must be array');
  assert.equal(progressData.data.deadlines.length, 5, 'Must contain exactly 5 key deadlines');

  // Verify all 5 key deadlines
  const expectedKeys = ['NOP_GIUA_KY', 'XAC_NHAN_GIUA_KY', 'NOP_CUOI_KY', 'PHAN_BIEN', 'BAO_VE'];
  const actualKeys = progressData.data.deadlines.map((d: any) => d.key);
  for (const expKey of expectedKeys) {
    assert(actualKeys.includes(expKey), `Deadlines must include key: ${expKey}`);
  }

  // Verify valid milestone statuses
  const validStatuses = ['CHUA_BAT_DAU', 'DANG_THUC_HIEN', 'HOAN_THANH', 'QUA_HAN'];
  for (const dl of progressData.data.deadlines) {
    assert(validStatuses.includes(dl.status), `Deadline status must be valid enum but got ${dl.status}`);
  }

  assert(Array.isArray(progressData.data.alerts), 'alerts must be an array');
  console.log(` -> Progress & Deadlines verified (percentComplete: ${progressData.data.percentComplete}%, 5 key deadlines, alerts).`);

  // ==========================================
  // 15. TESTING USE CASE "NỘP BÁO CÁO / TÀI LIỆU / MÃ NGUỒN / LINK"
  // ==========================================
  console.log('15. Testing Use Case "Nộp báo cáo / tài liệu / mã nguồn / link"...');

  // 15a. Submit with link & type MA_NGUON
  const subFormData1 = new FormData();
  subFormData1.append('type', 'MA_NGUON');
  subFormData1.append('link', 'https://github.com/test-student/kltn-source-repo');
  subFormData1.append('note', 'Nộp mã nguồn phiên bản 1');

  const sub1Res = await fetch(`${baseUrl}/submissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${svPropToken}` },
    body: subFormData1,
  });
  const sub1Data = await sub1Res.json();
  assert.equal(sub1Res.status, 201, `POST /submissions must return 201 but got ${sub1Res.status}: ${JSON.stringify(sub1Data)}`);
  assert.equal(sub1Data.data.version, 1, 'Initial submission version must be 1');
  assert.equal(sub1Data.data.status, 'CHUA_XEM', 'Initial status must be CHUA_XEM');
  assert.equal(sub1Data.data.type, 'MA_NGUON');
  assert.equal(sub1Data.data.sourceUrl, 'https://github.com/test-student/kltn-source-repo');

  // 15b. Submit second version (v2) with file & type BAO_CAO_TIEN_DO
  const subFormData2 = new FormData();
  subFormData2.append('type', 'BAO_CAO_TIEN_DO');
  const dummyFile = new Blob(['sample report content for testing'], { type: 'application/pdf' });
  subFormData2.append('file', dummyFile, 'bao-cao-tien-do-v2.pdf');
  subFormData2.append('note', 'Bản cập nhật v2 có kèm file PDF');

  const sub2Res = await fetch(`${baseUrl}/submissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${svPropToken}` },
    body: subFormData2,
  });
  const sub2Data = await sub2Res.json();
  assert.equal(sub2Res.status, 201);
  assert.equal(sub2Data.data.version, 1, 'New type version should start at 1');
  assert.equal(sub2Data.data.status, 'CHUA_XEM');
  assert(sub2Data.data.fileName.includes('bao-cao-tien-do-v2.pdf'));

  // 15c. Submit version 2 of MA_NGUON
  const subFormData3 = new FormData();
  subFormData3.append('type', 'MA_NGUON');
  subFormData3.append('link', 'https://github.com/test-student/kltn-source-repo/releases/v2.0');
  subFormData3.append('note', 'Nộp mã nguồn phiên bản 2');

  const sub3Res = await fetch(`${baseUrl}/submissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${svPropToken}` },
    body: subFormData3,
  });
  const sub3Data = await sub3Res.json();
  assert.equal(sub3Res.status, 201);
  assert.equal(sub3Data.data.version, 2, 'Consecutive submission of same type must auto-increment version to 2');

  // 15d. Test GET /submissions/me
  const mySubsRes = await fetch(`${baseUrl}/submissions/me`, {
    headers: { Authorization: `Bearer ${svPropToken}` },
  });
  const mySubsData = await mySubsRes.json();
  assert.equal(mySubsRes.status, 200, 'GET /submissions/me must return 200');
  assert(Array.isArray(mySubsData.data), 'mySubmissions must be array');
  assert(mySubsData.data.length >= 3, 'Must contain at least 3 submitted records');
  console.log(` -> Submissions verified (POST multipart/form-data, version auto-increment v1->v2, status CHUA_XEM, GET /submissions/me).`);

  // Verify GVHD received notification for submission
  const subNotifs = await prisma.notification.findMany({
    where: { userId: gvhdUser!.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  assert(
    subNotifs.some((n: any) => n.title?.includes('nộp bài') || n.message?.includes('nộp:')),
    'GVHD must receive notification about student submission',
  );
  console.log(' -> GVHD Notification for submission verified.');

  await app.close();
  console.log('ALL INTEGRATION CHECKS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});

