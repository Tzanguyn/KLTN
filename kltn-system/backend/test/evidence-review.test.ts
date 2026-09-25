import 'reflect-metadata';
import 'dotenv/config';
import { strict as assert } from 'assert';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

async function run() {
  console.log('=== TEST SUITE: DUYỆT MINH CHỨNG NCKH & CỘNG ĐIỂM THƯỞNG ===\n');

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
    // 1. Setup users (HOD & SV)
    console.log('1. Thiết lập người dùng kiểm thử (Trưởng BM và Sinh viên)...');
    const hodRole = await prisma.role.findUnique({ where: { code: 'TRUONG_BO_MON' } });
    const svRole = await prisma.role.findUnique({ where: { code: 'SINH_VIEN' } });
    const gvRole = await prisma.role.findUnique({ where: { code: 'GIANG_VIEN' } });

    assert(hodRole && svRole && gvRole, 'Roles must exist in DB');

    const timestamp = Date.now();
    const hodEmail = `hod_evi_${timestamp}@kltn.edu.vn`;
    const svEmail = `sv_evi_${timestamp}@kltn.edu.vn`;
    const gvEmail = `gv_evi_${timestamp}@kltn.edu.vn`;

    const dept = await prisma.department.findFirst();
    assert(dept, 'Department must exist');
    const sem = (await prisma.semester.findFirst({ where: { status: 'OPEN' } })) || (await prisma.semester.findFirst());
    assert(sem, 'Semester must exist');

    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash('Password123!', 10);

    const hodUser = await prisma.user.create({
      data: {
        email: hodEmail,
        fullName: 'GS. TSKH. Đặng Trưởng Khoa BM',
        passwordHash: hashed,
        roles: { create: { roleId: hodRole.id } },
        lecturerProfile: {
          create: {
            lecturerCode: `HOD_EV_${timestamp}`,
            departmentId: dept.id,
          },
        },
      },
    });

    const gvUser = await prisma.user.create({
      data: {
        email: gvEmail,
        fullName: 'TS. Hướng Dẫn KLTN',
        passwordHash: hashed,
        roles: { create: { roleId: gvRole.id } },
        lecturerProfile: {
          create: {
            lecturerCode: `GV_EV_${timestamp}`,
            departmentId: dept.id,
          },
        },
      },
    });

    const svUser = await prisma.user.create({
      data: {
        email: svEmail,
        fullName: 'Vũ Thị Minh Chứng NCKH',
        passwordHash: hashed,
        roles: { create: { roleId: svRole.id } },
        studentProfile: {
          create: {
            studentCode: `SV_EV_${timestamp}`,
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
      assert(res.status === 200 || res.status === 201, `Login failed for ${email}`);
      return data.data.accessToken;
    };

    const hodToken = await login(hodEmail);
    const svToken = await login(svEmail);
    const gvToken = await login(gvEmail);

    console.log(' -> Đã đăng nhập HOD, GV và SV thành công.\n');

    // 2. Setup Topic, Group & Initial Scores
    console.log('2. Thiết lập Đề tài, Nhóm và Bảng điểm KLTN cho sinh viên...');
    const topic = await prisma.topic.create({
      data: {
        title: `Phát triển hệ thống IoT và Trí tuệ nhân tạo ${timestamp}`,
        summary: 'Nghiên cứu ứng dụng IoT và AI trong nông nghiệp công nghệ cao.',
        ownerId: gvUser.id,
        departmentId: dept.id,
        semesterId: sem.id,
        status: 'APPROVED',
      },
    });

    const group = await prisma.group.create({
      data: {
        code: `GRP_EV_${timestamp}`,
        name: `Nhóm Khóa luận NCKH ${timestamp}`,
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

    // GV submits initial scores: 8.0/10
    await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        topicId: topic.id,
        scores: [
          { tieuChiId: 'TC01', score: 8.0, note: 'Tính cấp thiết tốt' },
          { tieuChiId: 'TC02', score: 8.0, note: 'Khảo sát đầy đủ' },
        ],
        isDraft: false,
      }),
    });
    console.log(' -> Đã khởi tạo điểm KLTN ban đầu cho nhóm.\n');

    // 3. Sinh viên nộp 3 minh chứng NCKH
    console.log('3. Sinh viên nộp 3 hồ sơ minh chứng NCKH...');
    // Minh chứng 1: Bài báo quốc tế IEEE
    const ev1 = await prisma.evidence.create({
      data: {
        userId: svUser.id,
        title: 'Bài báo khoa học quốc tế IEEE Access về mô hình phân loại dữ liệu IoT',
        description: 'Bài báo được chấp nhận đăng toàn văn trong kỷ yếu hội nghị quốc tế chuẩn IEEE/Scopus.',
        status: 'PENDING',
      },
    });

    // Minh chứng 2: Hoạt động ngoại khóa không hợp lệ
    const ev2 = await prisma.evidence.create({
      data: {
        userId: svUser.id,
        title: 'Giấy chứng nhận tham gia chiến dịch tình nguyện Mùa Hè Xanh',
        description: 'Hoạt động công tác xã hội và tình nguyện hè.',
        status: 'PENDING',
      },
    });

    // Minh chứng 3: Báo cáo NCKH cần bổ sung
    const ev3 = await prisma.evidence.create({
      data: {
        userId: svUser.id,
        title: 'Đề tài Nghiên cứu khoa học sinh viên cấp Trường đạt loại Khá',
        description: 'Bản thảo nghiệm thu đề tài NCKH sinh viên.',
        status: 'PENDING',
      },
    });

    console.log(` -> Đã tạo 3 minh chứng: EV1=${ev1.id}, EV2=${ev2.id}, EV3=${ev3.id}\n`);

    // 4. Kiểm thử GET /evidences?status=PENDING
    console.log('4. Kiểm thử GET /evidences?status=PENDING...');
    const listRes = await fetch(`${baseUrl}/evidences?status=PENDING`, {
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    const listData = await listRes.json();
    assert.equal(listRes.status, 200);
    assert(Array.isArray(listData.data), 'Data must be an array');

    const found1 = listData.data.find((e: any) => e.id === ev1.id);
    const found2 = listData.data.find((e: any) => e.id === ev2.id);
    const found3 = listData.data.find((e: any) => e.id === ev3.id);
    assert(found1 && found2 && found3, 'Must list all 3 pending evidences');
    assert.equal(found1.status, 'PENDING');
    assert.equal(found1.user?.fullName, 'Vũ Thị Minh Chứng NCKH');
    console.log(' -> GET /evidences?status=PENDING trả về danh sách chính xác.\n');

    // 5. Kiểm thử POST /evidences/:id/reject { lyDo }
    console.log('5. Kiểm thử POST /evidences/:id/reject { lyDo }...');
    const rejectReason = 'Hoạt động tình nguyện không thuộc danh mục NCKH được cộng điểm thưởng KLTN';
    const rejectRes = await fetch(`${baseUrl}/evidences/${ev2.id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`,
      },
      body: JSON.stringify({ lyDo: rejectReason }),
    });
    const rejectData = await rejectRes.json();
    assert.equal(rejectRes.status, 201);
    assert.equal(rejectData.data.evidence.status, 'REJECTED');
    assert.equal(rejectData.data.evidence.reviewNote, rejectReason);
    assert.equal(rejectData.data.evidence.points, null);

    // Verify DB & Audit Log for Reject
    const dbEv2 = await prisma.evidence.findUnique({ where: { id: ev2.id } });
    assert.equal(dbEv2?.status, 'REJECTED');
    assert.equal(dbEv2?.reviewNote, rejectReason);

    const rejectAudit = await prisma.auditLog.findFirst({
      where: { entityId: ev2.id, action: 'REJECT_EVIDENCE' },
    });
    assert(rejectAudit, 'Audit log must record REJECT_EVIDENCE');
    assert.equal(rejectAudit.userId, hodUser.id);
    const rejectMeta = rejectAudit.metadata as any;
    assert.equal(rejectMeta?.lyDo, rejectReason);

    // Verify SV notification
    const svNotifs = await prisma.notification.findMany({
      where: { userId: svUser.id },
      orderBy: { createdAt: 'desc' },
    });
    const rejectNotif = svNotifs.find((n) => n.title.includes('TỪ CHỐI'));
    assert(rejectNotif, 'SV must receive rejection notification');
    assert(rejectNotif.content.includes(rejectReason));
    console.log(' -> Từ chối minh chứng thành công! Đã ghi Audit Log và gửi thông báo.\n');

    // 6. Kiểm thử POST /evidences/:id/request-more-info
    console.log('6. Kiểm thử POST /evidences/:id/request-more-info...');
    const moreInfoNote = 'Vui lòng bổ sung giấy xác nhận nghiệm thu có chữ ký và con dấu của Phòng KHCN';
    const moreInfoRes = await fetch(`${baseUrl}/evidences/${ev3.id}/request-more-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`,
      },
      body: JSON.stringify({ note: moreInfoNote }),
    });
    const moreInfoData = await moreInfoRes.json();
    assert.equal(moreInfoRes.status, 201);
    assert.equal(moreInfoData.data.evidence.status, 'REQUEST_MORE_INFO');
    assert.equal(moreInfoData.data.evidence.reviewNote, moreInfoNote);

    // Verify DB & Audit Log for Request More Info
    const dbEv3 = await prisma.evidence.findUnique({ where: { id: ev3.id } });
    assert.equal(dbEv3?.status, 'REQUEST_MORE_INFO');
    assert.equal(dbEv3?.reviewNote, moreInfoNote);

    const moreInfoAudit = await prisma.auditLog.findFirst({
      where: { entityId: ev3.id, action: 'REQUEST_MORE_INFO_EVIDENCE' },
    });
    assert(moreInfoAudit, 'Audit log must record REQUEST_MORE_INFO_EVIDENCE');
    assert.equal(moreInfoAudit.userId, hodUser.id);

    // Verify SV notification
    const svNotifs2 = await prisma.notification.findMany({
      where: { userId: svUser.id },
      orderBy: { createdAt: 'desc' },
    });
    const moreInfoNotif = svNotifs2.find((n) => n.title.includes('bổ sung'));
    assert(moreInfoNotif, 'SV must receive request more info notification');
    assert(moreInfoNotif.content.includes(moreInfoNote));
    console.log(' -> Yêu cầu bổ sung thành công! Trạng thái REQUEST_MORE_INFO được cập nhật.\n');

    // 7. Kiểm thử POST /evidences/:id/approve (Tự động cộng điểm theo quy định cấu hình)
    console.log('7. Kiểm thử POST /evidences/:id/approve (Tự động cộng điểm theo quy định cấu hình)...');
    // Không truyền points trong body để kiểm tra thuật toán tự động phân tích cấu hình
    const approveRes = await fetch(`${baseUrl}/evidences/${ev1.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`,
      },
      body: JSON.stringify({}),
    });
    const approveData = await approveRes.json();
    assert.equal(approveRes.status, 201);
    assert.equal(approveData.data.evidence.status, 'APPROVED');

    // Bài báo quốc tế IEEE -> quy định cấu hình cộng 2.0 điểm
    const awardedPoints = Number(approveData.data.evidence.points);
    assert.equal(awardedPoints, 2.0, 'IEEE international article must award 2.0 bonus points per config rules');
    console.log(` -> Tự động nhận diện bài báo quốc tế IEEE: cộng ${awardedPoints} điểm thưởng.\n`);

    // Verify DB & Audit Log for Approve
    const dbEv1 = await prisma.evidence.findUnique({ where: { id: ev1.id } });
    assert.equal(dbEv1?.status, 'APPROVED');
    assert.equal(Number(dbEv1?.points), 2.0);
    assert.equal(dbEv1?.reviewedBy, hodUser.id);

    const approveAudit = await prisma.auditLog.findFirst({
      where: { entityId: ev1.id, action: 'APPROVE_EVIDENCE' },
    });
    assert(approveAudit, 'Audit log must record APPROVE_EVIDENCE');
    assert.equal(approveAudit.userId, hodUser.id);
    const approveMeta = approveAudit.metadata as any;
    assert.equal(approveMeta?.points, 2.0);
    assert(approveMeta?.matchedRule, 'Must record matched rule in audit log');

    // Verify SV notification
    const svNotifs3 = await prisma.notification.findMany({
      where: { userId: svUser.id },
      orderBy: { createdAt: 'desc' },
    });
    const approveNotif = svNotifs3.find((n) => n.title.includes('DUYỆT'));
    assert(approveNotif, 'SV must receive approval notification');
    assert(approveNotif.content.includes('2'), 'Must mention awarded points');
    console.log(' -> Phê duyệt thành công! Đã ghi Audit Log và gửi thông báo cộng điểm tới SV.\n');

    // 8. Kiểm thử Điểm thưởng NCKH được tích hợp vào Bảng điểm nhóm
    console.log('8. Kiểm tra Điểm thưởng NCKH phản ánh chính xác trong Bảng điểm nhóm (groupScores)...');
    const groupScoresRes = await fetch(`${baseUrl}/scores/groups/${group.id}`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const groupScoresData = await groupScoresRes.json();
    assert.equal(groupScoresRes.status, 200);
    assert.equal(groupScoresData.data.bonusPoints, 2.0, 'Group scores must include 2.0 bonus points');
    assert(groupScoresData.data.total >= groupScoresData.data.weightedScore + 2.0 || groupScoresData.data.total === 10, 'Total score must reflect bonus points');
    console.log(` -> Bảng điểm nhóm: Điểm tiêu chí=${groupScoresData.data.weightedScore}, Điểm NCKH=+${groupScoresData.data.bonusPoints}, Tổng điểm=${groupScoresData.data.total}/10.\n`);

    // 9. Dọn dẹp dữ liệu kiểm thử
    console.log('9. Dọn dẹp dữ liệu kiểm thử...');
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [ev1.id, ev2.id, ev3.id] } },
    });
    await prisma.evidence.deleteMany({
      where: { id: { in: [ev1.id, ev2.id, ev3.id] } },
    });
    await prisma.scoreHistory.deleteMany({
      where: { score: { groupId: group.id } },
    });
    await prisma.score.deleteMany({
      where: { groupId: group.id },
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
      where: { userId: { in: [svUser.id, hodUser.id, gvUser.id] } },
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [svUser.id, hodUser.id, gvUser.id] } },
    });
    await prisma.studentProfile.deleteMany({
      where: { userId: svUser.id },
    });
    await prisma.lecturerProfile.deleteMany({
      where: { userId: { in: [hodUser.id, gvUser.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [svUser.id, hodUser.id, gvUser.id] } },
    });

    console.log('=== TẤT CẢ CÁC BƯỚC KIỂM THỬ MINH CHỨNG NCKH ĐỀU ĐẠT CHUẨN 100%! ===\n');
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

