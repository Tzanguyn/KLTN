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

  console.log(`Starting Lecturer Topic Proposal Integration Test on port ${port}...`);

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

  // Ensure active semester registration is open
  await prisma.semester.updateMany({
    where: { status: 'OPEN' },
    data: {
      registrationFrom: new Date(Date.now() - 1000 * 60 * 60 * 24),
      registrationTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  const testTopicTitle = 'Đề tài Test IoT và Machine Learning 2026';

  // Clean up any previous test artifacts
  await prisma.registration.deleteMany({
    where: { student: { studentCode: { in: ['SV888888', 'SV999999'] } } },
  });
  await prisma.groupMember.deleteMany({
    where: { student: { studentCode: { in: ['SV888888', 'SV999999'] } } },
  });
  await prisma.studentProfile.deleteMany({
    where: { studentCode: { in: ['SV888888', 'SV999999'] } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: ['test_student_add_topic@kltn.edu.vn', 'sinhvien_temp_test2@kltn.edu.vn'] } },
  });
  await prisma.topic.deleteMany({
    where: { title: testTopicTitle },
  });

  try {
    const svToken = await login('sinhvien@kltn.edu.vn');
    const gvToken = await login('giangvien@kltn.edu.vn');
    const tbmToken = await login('truongbomon@kltn.edu.vn');

    const svUser = await prisma.user.findUnique({ where: { email: 'sinhvien@kltn.edu.vn' } });
    const gvUser = await prisma.user.findUnique({ where: { email: 'giangvien@kltn.edu.vn' } });
    const tbmUser = await prisma.user.findUnique({ where: { email: 'truongbomon@kltn.edu.vn' } });
    assert(svUser && gvUser && tbmUser, 'Seed accounts must exist');

    // 1. Check Pre-condition: Role GiangVien (Sinh viên không được gọi POST /topics)
    console.log('1. Checking Pre-condition: Student cannot register topic via POST /topics...');
    const svPostRes = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        tenDeTai: testTopicTitle,
        moTa: 'Mô tả đề tài',
        yeuCauSinhVien: 'Yêu cầu sinh viên',
        soLuongToiDa: 2,
      }),
    });
    assert.equal(svPostRes.status, 403, 'Student must be rejected with 403 Forbidden');
    console.log(' -> Pre-condition verified: Student blocked with 403.');

    // 2. Check Exception: Thiếu field → 400
    console.log('2. Checking Exception: Missing required fields returns 400 Bad Request...');
    // Case 2a: Empty body
    const emptyRes = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(emptyRes.status, 400, 'Empty body must return 400');

    // Case 2b: Missing moTa and soLuongToiDa
    const missingRes = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        tenDeTai: testTopicTitle,
        yeuCauSinhVien: 'Biết lập trình TypeScript',
      }),
    });
    assert.equal(missingRes.status, 400, 'Missing fields must return 400');

    // Case 2c: Invalid capacity (0 or negative)
    const invalidCapRes = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        tenDeTai: testTopicTitle,
        moTa: 'Mô tả hợp lệ',
        yeuCauSinhVien: 'Yêu cầu hợp lệ',
        soLuongToiDa: 0,
      }),
    });
    assert.equal(invalidCapRes.status, 400, 'Zero capacity must return 400');
    console.log(' -> Exception verified: Missing/invalid fields properly rejected with 400.');

    // 3. Check Exception: Vượt hạn mức → 403 "Bạn đã đạt số nhóm tối đa được phép hướng dẫn"
    console.log('3. Checking Exception: Exceeding quota returns 403 with specific message...');
    const originalProfile = await prisma.lecturerProfile.findUnique({
      where: { userId: gvUser.id },
    });
    assert(originalProfile, 'LecturerProfile must exist');

    // Temporarily set maxGroups = 0 to trigger quota limit
    await prisma.lecturerProfile.update({
      where: { userId: gvUser.id },
      data: { maxGroups: 0 },
    });

    const quotaRes = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        tenDeTai: testTopicTitle,
        moTa: 'Mô tả đề tài nghiên cứu hệ thống AI',
        yeuCauSinhVien: 'Yêu cầu sinh viên chăm chỉ, có kiến thức cơ bản',
        soLuongToiDa: 2,
      }),
    });
    const quotaJson = await quotaRes.json();
    assert.equal(quotaRes.status, 403, 'Exceeding quota must return 403 Forbidden');
    assert.equal(
      quotaJson.message,
      'Bạn đã đạt số nhóm tối đa được phép hướng dẫn',
      'Error message must match exact specification',
    );
    console.log(' -> Exception verified: 403 with message "Bạn đã đạt số nhóm tối đa được phép hướng dẫn".');

    // Restore lecturer's maxGroups
    await prisma.lecturerProfile.update({
      where: { userId: gvUser.id },
      data: { maxGroups: originalProfile.maxGroups },
    });

    // 4. Check Main Flow: POST /topics
    console.log('4. Checking Main Flow: Lecturer creates topic successfully...');
    const createRes = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        tenDeTai: testTopicTitle,
        moTa: 'Nghiên cứu ứng dụng IoT và AI trong giám sát chất lượng không khí',
        yeuCauSinhVien: 'Biết lập trình Python, có kinh nghiệm với phần cứng IoT',
        soLuongToiDa: 2,
      }),
    });

    const createJson = await createRes.json();
    assert.equal(createRes.status, 201, `Topic creation should return 201: ${JSON.stringify(createJson)}`);

    const createdData = createJson.data;
    assert.equal(createdData.title, testTopicTitle);
    assert.equal(createdData.tenDeTai, testTopicTitle);
    assert.equal(createdData.status, 'CHO_DUYET');
    assert.equal(createdData.trangThai, 'CHO_TRUONG_BM_DUYET');
    assert.equal(createdData.soLuongToiDa, 2);
    console.log(' -> Main Flow verified: Topic created with status CHO_DUYET & trangThai CHO_TRUONG_BM_DUYET.');

    // 5. Check Step 4: Notification cho Trưởng bộ môn
    console.log('5. Checking Notification for Trưởng bộ môn...');
    const tbmNotification = await prisma.notification.findFirst({
      where: {
        userId: tbmUser.id,
        data: {
          path: ['topicId'],
          equals: createdData.id,
        },
      },
    });
    assert(tbmNotification, 'Notification for Trưởng bộ môn must be created in DB');
    assert(tbmNotification.title.includes('phê duyệt'), 'Notification title must indicate review required');
    console.log(` -> Notification verified: Sent to Trưởng bộ môn (${tbmNotification.title}).`);

    // 6. Check API: GET /topics/my (GV xem đề tài của mình)
    console.log('6. Checking API GET /topics/my...');
    const myRes = await fetch(`${baseUrl}/topics/my`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${gvToken}`,
      },
    });
    const myJson = await myRes.json();
    assert.equal(myRes.status, 200, 'GET /topics/my must return 200 OK');
    const myList = myJson.data;
    assert(Array.isArray(myList), 'Response must be an array of topics');
    const foundCreated = myList.find((t: any) => t.id === createdData.id || t.title === testTopicTitle);
    assert(foundCreated, 'Newly created topic must be in lecturer topics list');
    assert.equal(foundCreated.tenDeTai, testTopicTitle);
    assert.equal(foundCreated.soLuongToiDa, 2);
    assert.equal(foundCreated.trangThai, 'CHO_TRUONG_BM_DUYET');
    console.log(' -> API GET /topics/my verified: Topic retrieved with full Vietnamese & English fields.');

    // 7. Check Alias: GET /topics/mine
    console.log('7. Checking Alias API GET /topics/mine...');
    const mineRes = await fetch(`${baseUrl}/topics/mine`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${gvToken}`,
      },
    });
    assert.equal(mineRes.status, 200, 'GET /topics/mine must return 200 OK');
    console.log(' -> Alias GET /topics/mine verified.');

    // 8. Check Feature: Giảng viên ẩn đề tài đã được duyệt khỏi danh sách hiển thị cho sinh viên
    console.log('8. Checking Feature: Lecturer hides approved topic from student list...');

    // 8a. Approve the test topic first
    await prisma.topic.update({
      where: { id: createdData.id },
      data: { status: 'APPROVED' },
    });

    // Verify it is initially visible to students
    const svListRes1 = await fetch(`${baseUrl}/topics`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    const svListJson1 = await svListRes1.json();
    const svItems1 = svListJson1.data?.items ?? svListJson1.data;
    assert(svItems1.some((t: any) => t.id === createdData.id), 'Topic must be visible to students when approved and not hidden');

    // 8b. Lecturer hides the topic via PATCH /topics/:id/hide
    const hideRes = await fetch(`${baseUrl}/topics/${createdData.id}/hide`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ isHidden: true }),
    });
    const hideJson = await hideRes.json();
    assert.equal(hideRes.status, 200, 'Hiding approved topic must return 200 OK');
    assert.equal(hideJson.data.isHidden, true, 'Topic isHidden must be true');

    // 8c. Verify topic is now HIDDEN from student list
    const svListRes2 = await fetch(`${baseUrl}/topics`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    const svListJson2 = await svListRes2.json();
    const svItems2 = svListJson2.data?.items ?? svListJson2.data;
    assert(!svItems2.some((t: any) => t.id === createdData.id), 'Hidden topic must NOT be in student list');

    // 8d. Verify topic is STILL VISIBLE in lecturer my topics list
    const gvListRes2 = await fetch(`${baseUrl}/topics/my`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const gvListJson2 = await gvListRes2.json();
    const gvFound = gvListJson2.data.find((t: any) => t.id === createdData.id);
    assert(gvFound, 'Hidden topic must still be visible in lecturer list');
    assert.equal(gvFound.isHidden, true, 'Lecturer sees isHidden = true');

    // 8e. Non-owner cannot hide the topic
    const gv2Token = await login('giangvien2@kltn.edu.vn');
    const unauthorizedHideRes = await fetch(`${baseUrl}/topics/${createdData.id}/hide`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gv2Token}`,
      },
      body: JSON.stringify({ isHidden: false }),
    });
    assert.equal(unauthorizedHideRes.status, 403, 'Non-owner must receive 403 Forbidden');

    // 8f. Unapproved topic cannot be hidden
    await prisma.topic.update({
      where: { id: createdData.id },
      data: { status: 'CHO_DUYET' },
    });
    const unapprovedHideRes = await fetch(`${baseUrl}/topics/${createdData.id}/hide`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ isHidden: true }),
    });
    assert.equal(unapprovedHideRes.status, 400, 'Cannot hide unapproved topic (400 Bad Request)');

    // 8g. Unhide topic test
    await prisma.topic.update({
      where: { id: createdData.id },
      data: { status: 'APPROVED' },
    });
    const unhideRes = await fetch(`${baseUrl}/topics/${createdData.id}/hide`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ isHidden: false }),
    });
    assert.equal(unhideRes.status, 200, 'Unhiding must return 200 OK');
    const svListRes3 = await fetch(`${baseUrl}/topics`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    const svListJson3 = await svListRes3.json();
    const svItems3 = svListJson3.data?.items ?? svListJson3.data;
    assert(svItems3.some((t: any) => t.id === createdData.id), 'Unhidden topic must reappear in student list');
    console.log(' -> Feature verified: Lecturer can hide/unhide approved topic from student list with full security checks.');

    // 9. Check GET /topics/my details: status, soLuongDaDangKy, soChoConLai
    console.log('9. Checking GET /topics/my contains status, soLuongDaDangKy, and soChoConLai...');
    const myTopicsRes = await fetch(`${baseUrl}/topics/my`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const myTopicsJson = await myTopicsRes.json();
    assert.equal(myTopicsRes.status, 200, 'GET /topics/my must return 200');
    const myTopic = myTopicsJson.data.find((t: any) => t.id === createdData.id);
    assert(myTopic, 'Topic must be found in my topics');
    assert.equal(typeof myTopic.soLuongDaDangKy, 'number', 'soLuongDaDangKy must be a number');
    assert.equal(typeof myTopic.soChoConLai, 'number', 'soChoConLai must be a number');
    assert.equal(myTopic.soLuongDaDangKy, 0, 'No students registered yet');
    assert.equal(myTopic.soChoConLai, 2, 'Remaining slots must be equal to capacity (2)');
    assert.equal(myTopic.conCho, true, 'conCho must be true');
    assert.equal(myTopic.choPhepChinhSua, true, 'Topic must be editable');
    console.log(' -> Verified: GET /topics/my contains status, soLuongDaDangKy (0) and soChoConLai (2).');

    // 10. Check PATCH /topics/:id: Update topic and verify restrictions
    console.log('10. Checking PATCH /topics/:id updates and restrictions...');

    // 10a. Successful update of title, summary, capacity
    const updatedTitle = 'Đề tài Test IoT và Machine Learning 2026 - Đã cập nhật';
    const patchRes1 = await fetch(`${baseUrl}/topics/${createdData.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        tenDeTai: updatedTitle,
        moTa: 'Mô tả mới đã được cập nhật',
        soLuongToiDa: 3,
      }),
    });
    const patchJson1 = await patchRes1.json();
    assert.equal(patchRes1.status, 200, 'PATCH /topics/:id must return 200 OK');
    assert.equal(patchJson1.data.title, updatedTitle);
    assert.equal(patchJson1.data.tenDeTai, updatedTitle);
    assert.equal(patchJson1.data.capacity, 3);
    assert.equal(patchJson1.data.status, 'CHO_DUYET', 'Topic status must be reset to CHO_DUYET upon content change');
    console.log(' -> 10a verified: Successfully updated title and capacity (status reset to CHO_DUYET).');

    // Verify GET /topics/my reflects updated capacity and remaining slots
    const myTopicsRes2 = await fetch(`${baseUrl}/topics/my`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const myTopicsJson2 = await myTopicsRes2.json();
    const myTopic2 = myTopicsJson2.data.find((t: any) => t.id === createdData.id);
    assert.equal(myTopic2.capacity, 3);
    assert.equal(myTopic2.soChoConLai, 3);

    // 10b. Reject update by non-owner (giangvien2)
    const patchNonOwnerRes = await fetch(`${baseUrl}/topics/${createdData.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gv2Token}`,
      },
      body: JSON.stringify({ tenDeTai: 'Hack title' }),
    });
    assert.equal(patchNonOwnerRes.status, 403, 'Non-owner update must return 403 Forbidden');
    console.log(' -> 10b verified: Non-owner blocked with 403.');

    // 10c. Reject update if status is ARCHIVED
    await prisma.topic.update({
      where: { id: createdData.id },
      data: { status: 'ARCHIVED' },
    });
    const patchArchivedRes = await fetch(`${baseUrl}/topics/${createdData.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ tenDeTai: 'Update archived' }),
    });
    assert.equal(patchArchivedRes.status, 400, 'Archived topic cannot be edited (400)');
    console.log(' -> 10c verified: ARCHIVED topic cannot be edited (400).');
    await prisma.topic.update({
      where: { id: createdData.id },
      data: { status: 'CHO_DUYET' },
    });

    // 10d. Reject update after deadline
    const activeSemester = await prisma.semester.findUnique({
      where: { id: createdData.semesterId },
    });
    assert(activeSemester, 'Active semester must exist');
    await prisma.semester.update({
      where: { id: activeSemester.id },
      data: { registrationTo: new Date(Date.now() - 1000 * 60 * 60) }, // 1 hour ago
    });

    const patchDeadlineRes = await fetch(`${baseUrl}/topics/${createdData.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ tenDeTai: 'Update after deadline' }),
    });
    const patchDeadlineJson = await patchDeadlineRes.json();
    assert.equal(patchDeadlineRes.status, 400, 'Update after deadline must return 400 Bad Request');
    assert(
      patchDeadlineJson.message.includes('thời hạn'),
      'Error message must indicate deadline expired',
    );
    console.log(' -> 10d verified: Editing blocked after registration deadline with 400.');

    // Restore deadline
    await prisma.semester.update({
      where: { id: activeSemester.id },
      data: { registrationTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) },
    });

    // 10e. Reject update after semester is closed
    await prisma.semester.update({
      where: { id: activeSemester.id },
      data: { status: 'CLOSED' },
    });
    const patchClosedRes = await fetch(`${baseUrl}/topics/${createdData.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ tenDeTai: 'Update when closed' }),
    });
    assert.equal(patchClosedRes.status, 400, 'Update when semester is closed must return 400');
    console.log(' -> 10e verified: Editing blocked when semester is closed with 400.');

    // Restore semester status
    await prisma.semester.update({
      where: { id: activeSemester.id },
      data: { status: 'OPEN' },
    });

    // 10f. Reject update after official student registration (APPROVED)
    const svProfile = await prisma.studentProfile.findUnique({
      where: { userId: svUser.id },
    });
    assert(svProfile, 'StudentProfile must exist');

    const testRegistration = await prisma.registration.create({
      data: {
        studentId: svProfile.id,
        topicId: createdData.id,
        semesterId: activeSemester.id,
        status: 'APPROVED',
      },
    });

    // Verify GET /topics/my reflects official registration and choPhepChinhSua is false
    const myTopicsRes3 = await fetch(`${baseUrl}/topics/my`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const myTopicsJson3 = await myTopicsRes3.json();
    const myTopic3 = myTopicsJson3.data.find((t: any) => t.id === createdData.id);
    assert.equal(myTopic3.soLuongDaDangKy, 1);
    assert.equal(myTopic3.soLuongChinhThuc, 1);
    assert.equal(myTopic3.soChoConLai, 2);
    assert.equal(myTopic3.choPhepChinhSua, false, 'choPhepChinhSua must be false when official student registered');

    // Try PATCH /topics/:id
    const patchOfficialRes = await fetch(`${baseUrl}/topics/${createdData.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ tenDeTai: 'Update when officially registered' }),
    });
    const patchOfficialJson = await patchOfficialRes.json();
    assert.equal(patchOfficialRes.status, 400, 'Update with official registration must return 400');
    assert.equal(
      patchOfficialJson.message,
      'Không thể chỉnh sửa đề tài sau khi đã có sinh viên đăng ký chính thức',
    );
    console.log(' -> 10f verified: Editing blocked when official registration exists (400).');

    // Clean up test registration
    await prisma.registration.delete({
      where: { id: testRegistration.id },
    });

    // 11. Check Feature: GET /topics/:id/registrations
    console.log('11. Checking GET /topics/:id/registrations...');

    // Ensure topic is APPROVED for registrations view & addition
    await prisma.topic.update({
      where: { id: createdData.id },
      data: { status: 'APPROVED' },
    });

    // 11a. Initial registrations list is empty
    const initialRegsRes = await fetch(`${baseUrl}/topics/${createdData.id}/registrations`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    assert.equal(initialRegsRes.status, 200, 'GET /topics/:id/registrations must return 200');
    const initialRegsJson = await initialRegsRes.json();
    assert.equal(initialRegsJson.data.soLuongDaDangKy, 0);
    assert.equal(initialRegsJson.data.registrations.length, 0);
    console.log(' -> 11a verified: Initial registrations list is empty.');

    // 11b. Non-owner cannot view registrations
    const nonOwnerRegsRes = await fetch(`${baseUrl}/topics/${createdData.id}/registrations`, {
      headers: { Authorization: `Bearer ${gv2Token}` },
    });
    assert.equal(nonOwnerRegsRes.status, 403, 'Non-owner must be blocked with 403');
    console.log(' -> 11b verified: Non-owner blocked with 403.');

    // 12. Check Feature: POST /topics/:id/add-student
    console.log('12. Checking POST /topics/:id/add-student validations & creation...');

    // Create a dedicated eligible test student without prior topic
    const testSvUser = await prisma.user.create({
      data: {
        email: 'test_student_add_topic@kltn.edu.vn',
        fullName: 'Nguyễn Văn Test Thêm SV',
        phone: '0987654321',
        passwordHash: 'dummy',
      },
    });
    const testSvProfile = await prisma.studentProfile.create({
      data: {
        userId: testSvUser.id,
        studentCode: 'SV888888',
        className: 'CNTT-K18',
        departmentId: svProfile.departmentId,
        eligible: true,
        creditsEarned: 125,
      },
    });

    // 12a. Non-owner cannot add student
    const addNonOwnerRes = await fetch(`${baseUrl}/topics/${createdData.id}/add-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gv2Token}`,
      },
      body: JSON.stringify({ studentId: testSvProfile.id }),
    });
    assert.equal(addNonOwnerRes.status, 403, 'Non-owner add student must return 403');
    console.log(' -> 12a verified: Non-owner cannot add student (403).');

    // 12b. Cannot add student to unapproved topic
    await prisma.topic.update({
      where: { id: createdData.id },
      data: { status: 'CHO_DUYET' },
    });
    const addUnapprovedRes = await fetch(`${baseUrl}/topics/${createdData.id}/add-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ studentId: testSvProfile.id }),
    });
    assert.equal(addUnapprovedRes.status, 400, 'Unapproved topic must return 400');
    console.log(' -> 12b verified: Cannot add student to unapproved topic (400).');
    await prisma.topic.update({
      where: { id: createdData.id },
      data: { status: 'APPROVED' },
    });

    // 12c. Cannot add ineligible student
    await prisma.studentProfile.update({
      where: { id: testSvProfile.id },
      data: { eligible: false },
    });
    const addIneligibleRes = await fetch(`${baseUrl}/topics/${createdData.id}/add-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ studentId: testSvProfile.id }),
    });
    assert.equal(addIneligibleRes.status, 400, 'Ineligible student must return 400');
    console.log(' -> 12c verified: Ineligible student blocked with 400.');
    await prisma.studentProfile.update({
      where: { id: testSvProfile.id },
      data: { eligible: true },
    });

    // 12d. Cannot add student who already has another topic/group in the semester (svProfile has topic1)
    const addConflictRes = await fetch(`${baseUrl}/topics/${createdData.id}/add-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ studentId: svProfile.id }),
    });
    assert.equal(addConflictRes.status, 409, 'Student with existing registration must return 409 Conflict');
    console.log(' -> 12d verified: Student with existing topic in semester blocked with 409.');

    // 12e. Main flow: Lecturer adds student to topic successfully
    const addSuccessRes = await fetch(`${baseUrl}/topics/${createdData.id}/add-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ studentId: testSvProfile.id }),
    });
    const addSuccessJson = await addSuccessRes.json();
    assert.equal(addSuccessRes.status, 201, `Add student must return 201: ${JSON.stringify(addSuccessJson)}`);
    assert.equal(addSuccessJson.data.status, 'APPROVED');
    assert.equal(addSuccessJson.data.trangThai, 'DA_XAC_NHAN');
    assert.equal(addSuccessJson.data.student.studentCode, testSvProfile.studentCode);
    assert(addSuccessJson.data.groupId, 'Group must be automatically linked/created');
    console.log(' -> 12e verified: Student successfully added to topic with status DA_XAC_NHAN (APPROVED).');

    // 12f. Notification received by student
    const studentNotification = await prisma.notification.findFirst({
      where: {
        userId: testSvUser.id,
        type: 'REGISTRATION',
        title: 'Bạn đã được thêm vào đề tài KLTN',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(studentNotification, 'Notification must be sent to student');
    console.log(' -> 12f verified: Student received notification about being added to topic.');

    // 12g. Duplicate add returns 409
    const duplicateAddRes = await fetch(`${baseUrl}/topics/${createdData.id}/add-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ studentId: testSvProfile.id }),
    });
    assert.equal(duplicateAddRes.status, 409, 'Duplicate student add must return 409');
    console.log(' -> 12g verified: Duplicate add properly rejected with 409.');

    // 12h. Check GET /topics/:id/registrations contains the student + full contact info
    const populatedRegsRes = await fetch(`${baseUrl}/topics/${createdData.id}/registrations`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const populatedRegsJson = await populatedRegsRes.json();
    assert.equal(populatedRegsRes.status, 200);
    assert.equal(populatedRegsJson.data.soLuongDaDangKy, 1);
    const registeredStudent = populatedRegsJson.data.registrations[0];
    assert.equal(registeredStudent.studentCode, testSvProfile.studentCode);
    assert.equal(registeredStudent.email, testSvUser.email);
    assert.equal(registeredStudent.phone, '0987654321');
    assert.equal(registeredStudent.soDienThoai, '0987654321');
    assert.equal(registeredStudent.trangThai, 'DA_XAC_NHAN');
    console.log(' -> 12h verified: GET /topics/:id/registrations returns student with full contact info (Email, Phone, MSSV, Class).');

    // 12i. Topic full capacity check
    await prisma.topic.update({
      where: { id: createdData.id },
      data: { capacity: 1 },
    });
    // Create a 2nd temporary eligible student to test capacity limit
    const tempUser2 = await prisma.user.create({
      data: {
        email: 'sinhvien_temp_test2@kltn.edu.vn',
        fullName: 'Sinh Viên Temp Test 2',
        passwordHash: 'dummy',
      },
    });
    const tempStudent2 = await prisma.studentProfile.create({
      data: {
        userId: tempUser2.id,
        studentCode: 'SV999999',
        departmentId: svProfile.departmentId,
        eligible: true,
        creditsEarned: 120,
      },
    });

    const fullCapRes = await fetch(`${baseUrl}/topics/${createdData.id}/add-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({ studentId: tempStudent2.id }),
    });
    assert.equal(fullCapRes.status, 409, 'Adding to full topic must return 409 Conflict');
    console.log(' -> 12i verified: Topic at capacity blocks additional student additions with 409.');

    // Clean up added registration and group first
    await prisma.registration.deleteMany({ where: { topicId: createdData.id } });
    const createdGroups = await prisma.group.findMany({ where: { topicId: createdData.id } });
    for (const g of createdGroups) {
      await prisma.groupMember.deleteMany({ where: { groupId: g.id } });
      await prisma.group.delete({ where: { id: g.id } });
    }

    // Clean up temporary students
    await prisma.studentProfile.deleteMany({ where: { id: { in: [tempStudent2.id, testSvProfile.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [tempUser2.id, testSvUser.id] } } });

    // Cleanup created topic and notifications
    await prisma.notification.deleteMany({
      where: {
        data: {
          path: ['topicId'],
          equals: createdData.id,
        },
      },
    });
    await prisma.topic.delete({
      where: { id: createdData.id },
    });
    console.log(' -> Cleaned up test topic, registrations, groups, and notifications.');

    console.log('\nALL LECTURER TOPIC PROPOSAL TESTS PASSED SUCCESSFULLY! ✅\n');
  } finally {
    await app.close();
  }
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

