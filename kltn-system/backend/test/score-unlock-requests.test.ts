import 'reflect-metadata';
import 'dotenv/config';
import { strict as assert } from 'assert';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

async function run() {
  console.log('=== TEST SUITE: PHÊ DUYỆT YÊU CẦU MỞ KHÓA ĐIỂM (SCORE UNLOCK REQUESTS) ===\n');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();
  const server = await app.listen(0);

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const prisma = app.get(PrismaService);

  try {
    // 1. Setup users & roles
    console.log('1. Thiết lập người dùng kiểm thử (GV, HOD, SV)...');
    const gvRole = await prisma.role.findUnique({ where: { code: 'GIANG_VIEN' } });
    const hodRole = await prisma.role.findUnique({ where: { code: 'TRUONG_BO_MON' } });
    const svRole = await prisma.role.findUnique({ where: { code: 'SINH_VIEN' } });

    assert(gvRole && hodRole && svRole, 'Roles must exist in DB');

    const timestamp = Date.now();
    const gvEmail = `gv_unlock_${timestamp}@kltn.edu.vn`;
    const hodEmail = `hod_unlock_${timestamp}@kltn.edu.vn`;
    const svEmail = `sv_unlock_${timestamp}@kltn.edu.vn`;

    const dept = await prisma.department.findFirst();
    assert(dept, 'Department must exist');
    const sem = (await prisma.semester.findFirst({ where: { status: 'OPEN' } })) || (await prisma.semester.findFirst());
    assert(sem, 'Semester must exist');

    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash('Password123!', 10);

    const gvUser = await prisma.user.create({
      data: {
        email: gvEmail,
        fullName: 'TS. Nguyễn Văn Chấm Điểm',
        passwordHash: hashed,
        roles: { create: { roleId: gvRole.id } },
        lecturerProfile: {
          create: {
            lecturerCode: `GV_UL_${timestamp}`,
            departmentId: dept.id,
          },
        },
      },
    });

    const hodUser = await prisma.user.create({
      data: {
        email: hodEmail,
        fullName: 'PGS. TS. Lê Trưởng Bộ Môn',
        passwordHash: hashed,
        roles: { create: { roleId: hodRole.id } },
        lecturerProfile: {
          create: {
            lecturerCode: `HOD_UL_${timestamp}`,
            departmentId: dept.id,
          },
        },
      },
    });

    const svUser = await prisma.user.create({
      data: {
        email: svEmail,
        fullName: 'Trần Sinh Viên Khóa Luận',
        passwordHash: hashed,
        roles: { create: { roleId: svRole.id } },
        studentProfile: {
          create: {
            studentCode: `SV_UL_${timestamp}`,
            departmentId: dept.id,
          },
        },
      },
      include: { studentProfile: true },
    });

    const login = async (email: string) => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password: 'Password123!' }),
      });
      const data = await res.json();
      assert(res.status === 200 || res.status === 201, `Login failed for ${email} (status ${res.status}): ${JSON.stringify(data)}`);
      return data.data.accessToken;
    };

    const gvToken = await login(gvEmail);
    const hodToken = await login(hodEmail);

    console.log(' -> Đã đăng nhập GV và HOD thành công.\n');

    // 2. Setup Topic, Group & Initial Locked Scores
    console.log('2. Thiết lập Đề tài, Nhóm và Bảng điểm ban đầu ở trạng thái LOCKED...');
    const topic = await prisma.topic.create({
      data: {
        title: `Hệ thống kiểm định tự động đề tài KLTN ${timestamp}`,
        summary: 'Tự động hóa phê duyệt và kiểm tra mở khóa điểm.',
        ownerId: gvUser.id,
        departmentId: dept.id,
        semesterId: sem.id,
        status: 'APPROVED',
      },
    });

    const group = await prisma.group.create({
      data: {
        code: `GRP_UL_${timestamp}`,
        name: `Nhóm Khóa luận Mở khóa ${timestamp}`,
        topicId: topic.id,
        semesterId: sem.id,
        status: 'ACTIVE',
        members: {
          create: {
            studentId: svUser.studentProfile!.id,
            isLeader: true,
          },
        },
      },
    });

    // GV submits official locked scores
    const submitInitRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        topicId: topic.id,
        scores: [
          { tieuChiId: 'TC01', score: 8.5, note: 'Điểm tiêu chí 1' },
          { tieuChiId: 'TC02', score: 9.0, note: 'Điểm tiêu chí 2' },
        ],
        isDraft: false,
      }),
    });
    assert.equal(submitInitRes.status, 201);
    console.log(' -> GV đã chấm điểm chính thức (status: LOCKED).\n');

    // Verify scores are LOCKED and cannot be edited
    const formBeforeRes = await fetch(`${baseUrl}/scoring-forms/${topic.id}`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const formBeforeData = await formBeforeRes.json();
    assert.equal(formBeforeData.data.isLocked, true, 'Form must be locked');
    assert.equal(formBeforeData.data.canEdit, false, 'canEdit must be false');

    // Attempting to modify locked scores should be rejected with 400
    const failUpdateRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        topicId: topic.id,
        scores: [{ tieuChiId: 'TC01', score: 9.5 }],
        isDraft: false,
      }),
    });
    assert.equal(failUpdateRes.status, 400, 'Must forbid editing locked scores');
    console.log(' -> Xác nhận: Điểm đã khóa không cho phép sửa trực tiếp.\n');

    // 3. GV creates unlock request 1
    console.log('3. GV gửi yêu cầu mở khóa sửa điểm lần 1...');
    const req1Res = await fetch(`${baseUrl}/scores/${topic.id}/unlock-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        reason: 'Cần sửa điểm tiêu chí 1 do sinh viên bổ sung tài liệu.',
      }),
    });
    const req1Data = await req1Res.json();
    assert.equal(req1Res.status, 201);
    const requestId1 = req1Data.data.request.id;
    assert(requestId1, 'Request ID 1 must exist');
    console.log(` -> Yêu cầu 1 được tạo: ID=${requestId1}, status=PENDING\n`);

    // 4. Test GET /score-unlock-requests?status=PENDING
    console.log('4. Kiểm thử GET /score-unlock-requests?status=PENDING...');
    const getListRes = await fetch(`${baseUrl}/score-unlock-requests?status=PENDING`, {
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    const getListData = await getListRes.json();
    assert.equal(getListRes.status, 200);
    assert(Array.isArray(getListData.data), 'Data must be an array');
    const foundReq1 = getListData.data.find((r: any) => r.id === requestId1);
    assert(foundReq1, 'Found request 1 in PENDING list');
    assert.equal(foundReq1.status, 'PENDING');
    assert.equal(foundReq1.requester?.fullName, 'TS. Nguyễn Văn Chấm Điểm');
    console.log(' -> GET /score-unlock-requests?status=PENDING thành công.\n');

    // 5. Test POST /score-unlock-requests/:id/reject { lyDo }
    console.log('5. Kiểm thử POST /score-unlock-requests/:id/reject { lyDo }...');
    const rejectReason = 'Tài liệu sinh viên bổ sung chưa có xác nhận của doanh nghiệp/tạp chí';
    const rejectRes = await fetch(`${baseUrl}/score-unlock-requests/${requestId1}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`,
      },
      body: JSON.stringify({ lyDo: rejectReason }),
    });
    const rejectData = await rejectRes.json();
    assert.equal(rejectRes.status, 201);
    assert.equal(rejectData.data.request.status, 'REJECTED');
    assert.equal(rejectData.data.request.rejectReason, rejectReason);
    console.log(' -> Phản hồi từ chối trả về chính xác status REJECTED và rejectReason.\n');

    // 6. Verify Database & Audit Log for Reject
    console.log('6. Kiểm tra Database & Audit Log cho hành động REJECT...');
    const dbReq1 = await prisma.scoreChangeRequest.findUnique({ where: { id: requestId1 } });
    assert.equal(dbReq1?.status, 'REJECTED');
    assert.equal(dbReq1?.rejectReason, rejectReason);
    assert.equal(dbReq1?.reviewedBy, hodUser.id);
    assert(dbReq1?.reviewedAt, 'reviewedAt must be set');

    const rejectAuditLog = await prisma.auditLog.findFirst({
      where: {
        entityId: requestId1,
        action: 'REJECT_SCORE_UNLOCK',
      },
    });
    assert(rejectAuditLog, 'Audit log must be recorded for REJECT_SCORE_UNLOCK');
    assert.equal(rejectAuditLog.userId, hodUser.id);
    const rejectMeta = rejectAuditLog.metadata as any;
    assert.equal(rejectMeta?.rejectReason, rejectReason);
    console.log(' -> Đã ghi nhận Audit Log đầy đủ cho REJECT_SCORE_UNLOCK.\n');

    // Verify GV notification for Reject
    const gvNotifs1 = await prisma.notification.findMany({
      where: { userId: gvUser.id, type: 'SCORE' },
      orderBy: { createdAt: 'desc' },
    });
    const rejectNotif = gvNotifs1.find((n) => n.title.includes('TỪ CHỐI'));
    assert(rejectNotif, 'GV must receive rejection notification');
    assert(rejectNotif.content.includes(rejectReason), 'Notification content must contain reason');
    console.log(' -> GV nhận được thông báo nêu rõ lý do từ chối.\n');

    // 7. GV creates unlock request 2
    console.log('7. GV gửi yêu cầu mở khóa lần 2 (đã bổ sung đầy đủ minh chứng)...');
    const req2Res = await fetch(`${baseUrl}/scores/${topic.id}/unlock-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        reason: 'Đã bổ sung đầy đủ văn bản xác nhận chính thức từ ban tổ chức.',
      }),
    });
    const req2Data = await req2Res.json();
    assert.equal(req2Res.status, 201);
    const requestId2 = req2Data.data.request.id;
    assert(requestId2, 'Request ID 2 must exist');
    console.log(` -> Yêu cầu 2 được tạo: ID=${requestId2}\n`);

    // 8. Test POST /score-unlock-requests/:id/approve { thoiHanChoPhepSua }
    console.log('8. Kiểm thử POST /score-unlock-requests/:id/approve { thoiHanChoPhepSua: 48 }...');
    const approveRes = await fetch(`${baseUrl}/score-unlock-requests/${requestId2}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`,
      },
      body: JSON.stringify({ thoiHanChoPhepSua: 48 }), // 48 hours
    });
    const approveData = await approveRes.json();
    assert.equal(approveRes.status, 201);
    assert.equal(approveData.data.request.status, 'APPROVED');
    assert(approveData.data.request.expiresAt, 'expiresAt must be returned');

    const expectedExpiryMin = Date.now() + 47 * 3600 * 1000;
    const expectedExpiryMax = Date.now() + 49 * 3600 * 1000;
    const actualExpiryTime = new Date(approveData.data.request.expiresAt).getTime();
    assert(
      actualExpiryTime >= expectedExpiryMin && actualExpiryTime <= expectedExpiryMax,
      'expiresAt must be roughly 48 hours in the future',
    );
    console.log(` -> Phê duyệt thành công! Hạn sửa điểm: ${approveData.data.request.expiresAt}\n`);

    // 9. Verify Database & Audit Log for Approve
    console.log('9. Kiểm tra Database & Audit Log cho hành động APPROVE...');
    const dbReq2 = await prisma.scoreChangeRequest.findUnique({ where: { id: requestId2 } });
    assert.equal(dbReq2?.status, 'APPROVED');
    assert(dbReq2?.expiresAt, 'expiresAt must be saved in DB');
    assert.equal(dbReq2?.reviewedBy, hodUser.id);

    // Verify scores are now OPENED with unlockedUntil set
    const groupScoresAfterApprove = await prisma.score.findMany({
      where: { groupId: group.id, scorerId: gvUser.id },
    });
    assert(groupScoresAfterApprove.length > 0, 'Group scores must exist');
    for (const sc of groupScoresAfterApprove) {
      assert.equal(sc.status, 'OPENED', 'Score status must be OPENED');
      assert(sc.unlockedUntil, 'Score unlockedUntil must be set');
    }
    console.log(' -> Toàn bộ điểm của nhóm đã chuyển sang OPENED với unlockedUntil tương ứng.\n');

    // Verify Audit Log for Approve
    const approveAuditLog = await prisma.auditLog.findFirst({
      where: {
        entityId: requestId2,
        action: 'APPROVE_SCORE_UNLOCK',
      },
    });
    assert(approveAuditLog, 'Audit log must be recorded for APPROVE_SCORE_UNLOCK');
    assert.equal(approveAuditLog.userId, hodUser.id);
    const approveMeta = approveAuditLog.metadata as any;
    assert(approveMeta?.expiresAt, 'Audit log metadata must contain expiresAt');
    assert(approveMeta?.unlockedScoresCount > 0, 'Audit log metadata must contain count of unlocked scores');
    console.log(' -> Đã ghi nhận Audit Log đầy đủ cho APPROVE_SCORE_UNLOCK.\n');

    // 10. Test Lecturer modifies scores within allowed time window
    console.log('10. Kiểm thử GV cập nhật điểm thành công trong thời hạn cho phép...');
    const formAfterApproveRes = await fetch(`${baseUrl}/scoring-forms/${topic.id}`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const formAfterApproveData = await formAfterApproveRes.json();
    assert.equal(formAfterApproveData.data.canEdit, true, 'canEdit must be TRUE after unlock approval');
    assert.equal(formAfterApproveData.data.isLocked, false, 'isLocked must be FALSE');
    assert.equal(formAfterApproveData.data.unlockRequest?.status, 'APPROVED');
    assert.equal(formAfterApproveData.data.unlockRequest?.isExpired, false);

    const updateScoreRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        topicId: topic.id,
        scores: [
          { tieuChiId: 'TC01', score: 9.5, note: 'Điểm sau khi bổ sung minh chứng hoàn chỉnh' },
          { tieuChiId: 'TC02', score: 9.5, note: 'Cập nhật hoàn tất' },
        ],
        isDraft: false,
      }),
    });
    assert.equal(updateScoreRes.status, 201, 'Updating score within allowed window must succeed');
    console.log(' -> GV cập nhật điểm mới thành công trong thời hạn cho phép.\n');

    // 11. Test Expiration: When allowed window expires, editing must be blocked and scores locked
    console.log('11. Kiểm thử khi HẾT THỜI HẠN cho phép sửa điểm...');
    // Simulate expired deadline (1 hour in the past)
    const pastDate = new Date(Date.now() - 3600 * 1000);
    await prisma.scoreChangeRequest.update({
      where: { id: requestId2 },
      data: { expiresAt: pastDate },
    });
    await prisma.score.updateMany({
      where: { groupId: group.id, scorerId: gvUser.id },
      data: { status: 'OPENED', unlockedUntil: pastDate },
    });

    // Scoring form should detect expired unlock and auto-lock
    const formExpiredRes = await fetch(`${baseUrl}/scoring-forms/${topic.id}`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const formExpiredData = await formExpiredRes.json();
    assert.equal(formExpiredData.data.canEdit, false, 'canEdit must be FALSE when unlock window expired');
    assert.equal(formExpiredData.data.isLocked, true, 'isLocked must be TRUE when expired');
    assert.equal(formExpiredData.data.unlockRequest?.isExpired, true, 'isExpired must be TRUE');

    // Attempt to update score after expiration must fail with 400
    const failAfterExpiredRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        topicId: topic.id,
        scores: [{ tieuChiId: 'TC01', score: 10.0 }],
        isDraft: false,
      }),
    });
    assert.equal(failAfterExpiredRes.status, 400, 'Must block score update after expiration');
    const failAfterExpiredData = await failAfterExpiredRes.json();
    assert(
      failAfterExpiredData.message.includes('hết') || failAfterExpiredData.message.includes('khóa'),
      'Must explain that time limit expired or score is locked',
    );
    console.log(' -> Hệ thống tự động khóa lại điểm và từ chối cập nhật khi hết thời hạn cho phép.\n');

    // 12. Cleanup test data
    console.log('12. Dọn dẹp dữ liệu kiểm thử...');
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [requestId1, requestId2] } },
    });
    await prisma.scoreHistory.deleteMany({
      where: { score: { groupId: group.id } },
    });
    await prisma.score.deleteMany({
      where: { groupId: group.id },
    });
    await prisma.scoreChangeRequest.deleteMany({
      where: { id: { in: [requestId1, requestId2] } },
    });
    await prisma.groupMember.deleteMany({
      where: { groupId: group.id },
    });
    await prisma.group.deleteMany({
      where: { id: group.id },
    });
    await prisma.topic.deleteMany({
      where: { id: topic.id },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: [gvUser.id, hodUser.id] } },
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [gvUser.id, hodUser.id, svUser.id] } },
    });
    await prisma.lecturerProfile.deleteMany({
      where: { userId: { in: [gvUser.id, hodUser.id] } },
    });
    await prisma.studentProfile.deleteMany({
      where: { userId: svUser.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [gvUser.id, hodUser.id, svUser.id] } },
    });

    console.log('=== TẤT CẢ CÁC BƯỚC KIỂM THỬ ĐỀU ĐẠT CHUẨN 100%! ===\n');
  } finally {
    await app.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST ERROR:', err);
    process.exit(1);
  });

