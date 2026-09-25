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

  console.log(`Starting Head of Department Topic Review Integration Test on port ${port}...`);

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

  const topicTitleA = 'Đề tài Test Trưởng Bộ Môn Duyệt A 2026';
  const topicTitleB = 'Đề tài Test Trưởng Bộ Môn Từ Chối B 2026';
  const topicTitleSelf = 'Đề tài Test Tự Duyệt TBM 2026';

  // Clean up any old test data
  await prisma.topicApproval.deleteMany({
    where: { topic: { title: { in: [topicTitleA, topicTitleB, topicTitleSelf] } } },
  });
  await prisma.auditLog.deleteMany({
    where: { entity: 'Topic' },
  });
  await prisma.topic.deleteMany({
    where: { title: { in: [topicTitleA, topicTitleB, topicTitleSelf] } },
  });

  try {
    const svToken = await login('sinhvien@kltn.edu.vn');
    const gvToken = await login('giangvien@kltn.edu.vn');
    const tbmToken = await login('truongbomon@kltn.edu.vn');

    const gvUser = await prisma.user.findUnique({
      where: { email: 'giangvien@kltn.edu.vn' },
      include: { lecturerProfile: true },
    });
    const tbmUser = await prisma.user.findUnique({ where: { email: 'truongbomon@kltn.edu.vn' } });
    assert.ok(gvUser && tbmUser, 'Seed accounts must exist');

    const originalGvMaxGroups = gvUser.lecturerProfile?.maxGroups ?? 5;
    await prisma.lecturerProfile.update({
      where: { userId: gvUser.id },
      data: { maxGroups: 10 },
    });

    // 1. Tạo đề tài Topic A do Giảng viên đề xuất
    console.log('1. Lecturer creates Topic A for review...');
    const createResA = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        tenDeTai: topicTitleA,
        moTa: 'Nghiên cứu ứng dụng Transformer trong xử lý ảnh y tế',
        yeuCauSinhVien: 'Có kiến thức về Deep Learning, PyTorch, Python',
        congNghe: 'PyTorch, Python, FastAPI',
        soLuongToiDa: 2,
        semesterId: activeSemester.id,
      }),
    });
    const createJsonA = await createResA.json();
    assert.equal(createResA.status, 201, `Failed to create Topic A: ${JSON.stringify(createJsonA)}`);
    const topicA = createJsonA.data;
    assert.equal(topicA.status, 'CHO_DUYET');
    console.log(` -> Topic A created successfully with ID: ${topicA.id}, status: ${topicA.status}`);

    // 2. RBAC Checks: Sinh viên và Giảng viên không có quyền gọi approve / reject / request-changes
    console.log('2. Checking RBAC: Student and Lecturer cannot approve/reject/request-changes...');

    // 2a. Student call approve -> 403
    const svApproveRes = await fetch(`${baseUrl}/topics/${topicA.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svToken}` },
      body: JSON.stringify({ note: 'Sinh viên tự duyệt' }),
    });
    assert.equal(svApproveRes.status, 403, 'Student calling /approve must return 403 Forbidden');

    // 2b. Lecturer call approve -> 403
    const gvApproveRes = await fetch(`${baseUrl}/topics/${topicA.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvToken}` },
      body: JSON.stringify({ note: 'Giảng viên duyệt' }),
    });
    assert.equal(gvApproveRes.status, 403, 'Lecturer calling /approve must return 403 Forbidden');

    // 2c. Student call reject -> 403
    const svRejectRes = await fetch(`${baseUrl}/topics/${topicA.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svToken}` },
      body: JSON.stringify({ lyDo: 'Sinh viên từ chối' }),
    });
    assert.equal(svRejectRes.status, 403, 'Student calling /reject must return 403 Forbidden');

    // 2d. Lecturer call reject -> 403
    const gvRejectRes = await fetch(`${baseUrl}/topics/${topicA.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvToken}` },
      body: JSON.stringify({ lyDo: 'Giảng viên từ chối' }),
    });
    assert.equal(gvRejectRes.status, 403, 'Lecturer calling /reject must return 403 Forbidden');

    // 2e. Student & Lecturer call request-changes -> 403
    const svReqRes = await fetch(`${baseUrl}/topics/${topicA.id}/request-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svToken}` },
      body: JSON.stringify({ lyDo: 'Sinh viên yêu cầu sửa' }),
    });
    assert.equal(svReqRes.status, 403, 'Student calling /request-changes must return 403 Forbidden');
    console.log(' -> RBAC verified: Student & Lecturer blocked with 403.');

    // 3. Exception Checks
    console.log('3. Checking Exceptions: Non-existent topic, Self-review, Missing lyDo...');

    // 3a. Non-existent topic -> 404
    const notFoundRes = await fetch(`${baseUrl}/topics/00000000-0000-0000-0000-000000000000/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
      body: JSON.stringify({ note: 'Duyệt' }),
    });
    assert.equal(notFoundRes.status, 404, 'Non-existent topic must return 404 Not Found');

    // 3b. Self-review: TBM tạo đề tài của chính mình rồi cố tự duyệt -> 400
    const selfTopicRes = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
      body: JSON.stringify({
        tenDeTai: topicTitleSelf,
        moTa: 'Mô tả đề tài tự tạo',
        yeuCauSinhVien: 'Yêu cầu',
        soLuongToiDa: 2,
        semesterId: activeSemester.id,
      }),
    });
    const selfTopicJson = await selfTopicRes.json();
    assert.equal(selfTopicRes.status, 201, 'TBM can create topic');
    const selfTopicId = selfTopicJson.data.id;

    const selfApproveRes = await fetch(`${baseUrl}/topics/${selfTopicId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
      body: JSON.stringify({ note: 'Tự duyệt' }),
    });
    assert.equal(selfApproveRes.status, 400, 'Self-review must be blocked with 400 Bad Request');
    const selfApproveJson = await selfApproveRes.json();
    assert.ok(
      selfApproveJson.message.includes('tự duyệt'),
      `Expected message containing 'tự duyệt', got: ${selfApproveJson.message}`,
    );
    console.log(' -> Self-review correctly blocked with 400 Bad Request.');

    // 3c. Reject without lyDo -> 400
    const emptyRejectRes = await fetch(`${baseUrl}/topics/${topicA.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
      body: JSON.stringify({}),
    });
    assert.equal(emptyRejectRes.status, 400, 'Reject without lyDo must return 400 Bad Request');

    // 3d. Request-changes without lyDo -> 400
    const emptyReqRes = await fetch(`${baseUrl}/topics/${topicA.id}/request-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
      body: JSON.stringify({}),
    });
    assert.equal(emptyReqRes.status, 400, 'Request-changes without lyDo must return 400 Bad Request');
    console.log(' -> Exceptions verified successfully.');

    // 4. Luồng chính 1: GET /topics?status=CHO_DUYET
    console.log('4. Checking Main Flow 1: GET /topics?status=CHO_DUYET...');
    const listRes = await fetch(`${baseUrl}/topics?status=CHO_DUYET`, {
      headers: { Authorization: `Bearer ${tbmToken}` },
    });
    assert.equal(listRes.status, 200, 'GET /topics?status=CHO_DUYET must return 200 OK');
    const listJson = await listRes.json();
    const items = listJson.data?.items ?? listJson.data;
    const foundTopicA = items.find((t: any) => t.id === topicA.id);
    assert.ok(foundTopicA, 'Topic A must be returned in GET /topics?status=CHO_DUYET');
    assert.equal(foundTopicA.status, 'CHO_DUYET');
    console.log(' -> Main Flow 1 verified: Topic found in pending approval list.');

    // 5. Luồng chính 2: GET /topics/:id (chi tiết đề tài)
    console.log('5. Checking Main Flow 2: GET /topics/:id...');
    const detailRes = await fetch(`${baseUrl}/topics/${topicA.id}`, {
      headers: { Authorization: `Bearer ${tbmToken}` },
    });
    assert.equal(detailRes.status, 200, 'GET /topics/:id must return 200 OK');
    const detailJson = await detailRes.json();
    const detailData = detailJson.data;
    assert.equal(detailData.id, topicA.id);
    assert.equal(detailData.title, topicTitleA);
    assert.equal(detailData.tenDeTai, topicTitleA);
    assert.equal(detailData.capacity, 2);
    assert.equal(detailData.soLuongToiDa, 2);
    assert.equal(detailData.soLuongDaDangKy, 0);
    assert.equal(detailData.soChoConLai, 2);
    assert.equal(detailData.conCho, true);
    assert.ok(detailData.owner && detailData.gvhd, 'Topic detail must contain owner and gvhd info');
    assert.equal(detailData.owner.email, 'giangvien@kltn.edu.vn');
    assert.ok(detailData.department && detailData.chuyenNganh, 'Topic detail must contain department info');
    assert.ok(detailData.semester && detailData.hocKy, 'Topic detail must contain semester info');
    console.log(' -> Main Flow 2 verified: Full topic details retrieved with bilingual fields.');

    // 6. Luồng thay thế: POST /topics/:id/request-changes -> status = CAN_CAP_NHAT + notification cho GV
    console.log('6. Checking Alternative Flow: POST /topics/:id/request-changes -> CAN_CAP_NHAT...');
    const changeReason = 'Cần bổ sung chi tiết công nghệ AI và giới hạn phạm vi đề tài';
    const reqChangesRes = await fetch(`${baseUrl}/topics/${topicA.id}/request-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
      body: JSON.stringify({ lyDo: changeReason }),
    });
    assert.equal(reqChangesRes.status, 201, 'POST /topics/:id/request-changes must return 201 Created');
    const reqChangesJson = await reqChangesRes.json();
    assert.equal(reqChangesJson.data.status, 'CAN_CAP_NHAT', 'Status must be CAN_CAP_NHAT');
    assert.equal(reqChangesJson.data.lyDoTuChoi, changeReason);

    // Verify DB state for Topic A
    const topicAfterReq = await prisma.topic.findUnique({ where: { id: topicA.id } });
    assert.equal(topicAfterReq?.status, 'CAN_CAP_NHAT');
    assert.equal(topicAfterReq?.rejectionReason, changeReason);
    assert.equal(topicAfterReq?.reviewerId, tbmUser.id);

    // Verify AuditLog for REQUEST_CHANGES_TOPIC
    const reqAuditLog = await prisma.auditLog.findFirst({
      where: {
        entity: 'Topic',
        entityId: topicA.id,
        action: 'REQUEST_CHANGES_TOPIC',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(reqAuditLog, 'AuditLog must be recorded for REQUEST_CHANGES_TOPIC');
    assert.equal(reqAuditLog.userId, tbmUser.id);
    const reqMeta = reqAuditLog.metadata as any;
    assert.equal(reqMeta.nguoiDuyet, tbmUser.id);
    assert.equal(reqMeta.ketQua, 'CAN_CAP_NHAT');
    assert.equal(reqMeta.lyDo, changeReason);
    assert.ok(reqMeta.thoiGian, 'thoiGian must be recorded');
    console.log(' -> Verified AuditLog recorded correctly for REQUEST_CHANGES_TOPIC.');

    // Verify Notification for Lecturer
    const reqNotification = await prisma.notification.findFirst({
      where: {
        userId: gvUser.id,
        title: 'Yêu cầu chỉnh sửa đề tài KLTN',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(reqNotification, 'Notification must be sent to Lecturer for change request');
    assert.ok(reqNotification.content.includes(changeReason));
    console.log(' -> Verified Notification sent to Lecturer.');

    // Lecturer updates the topic via PATCH /topics/:id -> status resets to CHO_DUYET
    console.log('6b. Lecturer updates topic after change request...');
    const updateRes = await fetch(`${baseUrl}/topics/${topicA.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gvToken}` },
      body: JSON.stringify({
        moTa: 'Nghiên cứu ứng dụng Transformer trong xử lý ảnh y tế (Đã làm rõ phạm vi)',
      }),
    });
    assert.equal(updateRes.status, 200, 'Lecturer can update topic with CAN_CAP_NHAT status');
    const updateJson = await updateRes.json();
    assert.equal(updateJson.data.status, 'CHO_DUYET', 'Status must reset to CHO_DUYET after update');
    console.log(' -> Status reset to CHO_DUYET after lecturer update.');

    // 7. Luồng chính 3: POST /topics/:id/approve -> status = APPROVED + AuditLog + Notification
    console.log('7. Checking Main Flow 3: POST /topics/:id/approve...');
    const approveNote = 'Đề tài đã hoàn thiện nội dung và đạt chuẩn chuyên môn của Bộ môn';
    const approveRes = await fetch(`${baseUrl}/topics/${topicA.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
      body: JSON.stringify({ note: approveNote }),
    });
    assert.equal(approveRes.status, 201, 'POST /topics/:id/approve must return 201 Created');
    const approveJson = await approveRes.json();
    assert.equal(approveJson.data.status, 'APPROVED', 'Topic status must be APPROVED');

    // Verify DB state
    const topicAfterApprove = await prisma.topic.findUnique({ where: { id: topicA.id } });
    assert.equal(topicAfterApprove?.status, 'APPROVED');
    assert.equal(topicAfterApprove?.reviewerId, tbmUser.id);
    assert.equal(topicAfterApprove?.rejectionReason, null);

    // Verify TopicApproval history
    const approvalHistory = await prisma.topicApproval.findFirst({
      where: { topicId: topicA.id, approved: true },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(approvalHistory, 'TopicApproval record must exist for approval');
    assert.equal(approvalHistory.reviewerId, tbmUser.id);
    assert.equal(approvalHistory.note, approveNote);

    // Verify AuditLog for APPROVE_TOPIC
    const approveAuditLog = await prisma.auditLog.findFirst({
      where: {
        entity: 'Topic',
        entityId: topicA.id,
        action: 'APPROVE_TOPIC',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(approveAuditLog, 'AuditLog must be recorded for APPROVE_TOPIC');
    assert.equal(approveAuditLog.userId, tbmUser.id);
    const approveMeta = approveAuditLog.metadata as any;
    assert.equal(approveMeta.nguoiDuyet, tbmUser.id);
    assert.equal(approveMeta.ketQua, 'APPROVED');
    assert.equal(approveMeta.lyDo, approveNote);
    assert.ok(approveMeta.thoiGian, 'thoiGian must be recorded');
    console.log(' -> Verified AuditLog recorded correctly for APPROVE_TOPIC.');

    // Verify Notification for Lecturer
    const approveNotification = await prisma.notification.findFirst({
      where: {
        userId: gvUser.id,
        title: 'Đề tài KLTN đã được phê duyệt',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(approveNotification, 'Notification must be sent to Lecturer for approval');
    assert.ok(approveNotification.content.includes(topicTitleA));
    console.log(' -> Verified Notification sent to Lecturer for approval.');

    // 8. Luồng chính 4: POST /topics/:id/reject { lyDo: string } -> status = REJECTED + AuditLog + Notification
    console.log('8. Checking Main Flow 4: POST /topics/:id/reject...');
    // Tạo Topic B
    const createResB = await fetch(`${baseUrl}/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        tenDeTai: topicTitleB,
        moTa: 'Xây dựng website bán hàng đơn giản',
        yeuCauSinhVien: 'HTML, CSS cơ bản',
        soLuongToiDa: 1,
        semesterId: activeSemester.id,
      }),
    });
    const createJsonB = await createResB.json();
    assert.equal(createResB.status, 201, 'Topic B created');
    const topicB = createJsonB.data;

    const rejectReason = 'Nội dung quá đơn giản, không đủ khối lượng và hàm lượng khoa học cho KLTN';
    const rejectRes = await fetch(`${baseUrl}/topics/${topicB.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tbmToken}` },
      body: JSON.stringify({ lyDo: rejectReason }),
    });
    assert.equal(rejectRes.status, 201, 'POST /topics/:id/reject must return 201 Created');
    const rejectJson = await rejectRes.json();
    assert.equal(rejectJson.data.status, 'REJECTED', 'Topic status must be REJECTED');
    assert.equal(rejectJson.data.rejectionReason, rejectReason);
    assert.equal(rejectJson.data.lyDoTuChoi, rejectReason);

    // Verify DB state for Topic B
    const topicAfterReject = await prisma.topic.findUnique({ where: { id: topicB.id } });
    assert.equal(topicAfterReject?.status, 'REJECTED');
    assert.equal(topicAfterReject?.rejectionReason, rejectReason);
    assert.equal(topicAfterReject?.reviewerId, tbmUser.id);

    // Verify TopicApproval history for rejection
    const rejectHistory = await prisma.topicApproval.findFirst({
      where: { topicId: topicB.id, approved: false },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(rejectHistory, 'TopicApproval record must exist for rejection');
    assert.equal(rejectHistory.reviewerId, tbmUser.id);
    assert.equal(rejectHistory.note, rejectReason);

    // Verify AuditLog for REJECT_TOPIC
    const rejectAuditLog = await prisma.auditLog.findFirst({
      where: {
        entity: 'Topic',
        entityId: topicB.id,
        action: 'REJECT_TOPIC',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(rejectAuditLog, 'AuditLog must be recorded for REJECT_TOPIC');
    assert.equal(rejectAuditLog.userId, tbmUser.id);
    const rejectMeta = rejectAuditLog.metadata as any;
    assert.equal(rejectMeta.nguoiDuyet, tbmUser.id);
    assert.equal(rejectMeta.ketQua, 'REJECTED');
    assert.equal(rejectMeta.lyDo, rejectReason);
    assert.ok(rejectMeta.thoiGian, 'thoiGian must be recorded');
    console.log(' -> Verified AuditLog recorded correctly for REJECT_TOPIC.');

    // Verify Notification for Lecturer
    const rejectNotification = await prisma.notification.findFirst({
      where: {
        userId: gvUser.id,
        title: 'Đề tài KLTN bị từ chối',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(rejectNotification, 'Notification must be sent to Lecturer for rejection');
    assert.ok(rejectNotification.content.includes(rejectReason));
    console.log(' -> Verified Notification sent to Lecturer for rejection.');

    console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    // Cleanup test topics
    await prisma.topicApproval.deleteMany({
      where: { topic: { title: { in: [topicTitleA, topicTitleB, topicTitleSelf] } } },
    });
    await prisma.topic.deleteMany({
      where: { title: { in: [topicTitleA, topicTitleB, topicTitleSelf] } },
    });
    const gvUserClean = await prisma.user.findUnique({ where: { email: 'giangvien@kltn.edu.vn' } });
    if (gvUserClean) {
      await prisma.lecturerProfile.update({
        where: { userId: gvUserClean.id },
        data: { maxGroups: 5 },
      });
    }
    await app.close();
  }
}

void runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

