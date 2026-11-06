import { PrismaClient, RoleCode, UserStatus, SemesterStatus, TopicStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RAW_TOPICS } from './raw-topics';

const prisma = new PrismaClient();

function hexToUuid(hex: string): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (clean.length === 32) {
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  return clean;
}

const LECTURER_DATA: Record<string, { email: string; code: string; title: string }> = {
  'Bùi Văn Đồng': { email: 'dong.buivan@kltn.edu.vn', code: 'GV_BVD', title: 'ThS.' },
  'Huỳnh Nam': { email: 'nam.huynh@kltn.edu.vn', code: 'GV_HN', title: 'ThS.' },
  'Lê Thùy Trang': { email: 'trang.lethuy@kltn.edu.vn', code: 'GV_LTT', title: 'ThS.' },
  'Lê Trọng Hiền': { email: 'hien.letrong@kltn.edu.vn', code: 'GV_LTH', title: 'ThS.' },
  'Ngô Hữu Dũng': { email: 'dung.ngohuud@kltn.edu.vn', code: 'GV_NHD', title: 'ThS.' },
  'Nguyễn Hữu Quang': { email: 'quang.nguyenhuu@kltn.edu.vn', code: 'GV_NHQ', title: 'ThS.' },
  'Nguyễn Thị Thanh Bình': { email: 'binh.nguyenthithanh@kltn.edu.vn', code: 'GV_NTTB', title: 'TS.' },
  'Phạm Thị Xuân Hiền': { email: 'hien.phamthixuan@kltn.edu.vn', code: 'GV_PTXH', title: 'ThS.' },
  'Phan Thị Bảo Trân': { email: 'tran.phanthibao@kltn.edu.vn', code: 'GV_PTBT', title: 'ThS.' },
  'Trần Thị Kim Chi': { email: 'chi.tranthikim@kltn.edu.vn', code: 'GV_TTKC', title: 'ThS.' },
  'Võ Ngọc Tấn Phước': { email: 'phuoc.vongoctan@kltn.edu.vn', code: 'GV_VNTP', title: 'ThS.' },
};

async function main() {
  const roles = [
    [RoleCode.ADMIN, 'Quản trị viên'],
    [RoleCode.SINH_VIEN, 'Sinh viên'],
    [RoleCode.GIANG_VIEN, 'Giảng viên'],
    [RoleCode.TRUONG_BO_MON, 'Trưởng bộ môn'],
    [RoleCode.QUAN_LY_BO_MON, 'Quản lý bộ môn'],
  ] as const;
  const roleMap = new Map<RoleCode, string>();
  for (const [code, name] of roles) {
    const role = await prisma.role.upsert({ where: { code }, update: { name }, create: { code, name } });
    roleMap.set(code, role.id);
  }

  const department = await prisma.department.upsert({
    where: { code: 'CNTT' },
    update: {},
    create: { code: 'CNTT', name: 'Công nghệ thông tin', description: 'Bộ môn Công nghệ thông tin' },
  });

  const departmentIS = await prisma.department.upsert({
    where: { code: 'IS' },
    update: { name: 'Hệ thống thông tin', description: 'Bộ môn Hệ thống thông tin' },
    create: { code: 'IS', name: 'Hệ thống thông tin', description: 'Bộ môn Hệ thống thông tin' },
  });

  const semester = await prisma.semester.upsert({
    where: { code: '2026-KLTN-1' },
    update: { status: SemesterStatus.OPEN },
    create: {
      code: '2026-KLTN-1',
      name: 'Đợt KLTN học kỳ 1 năm 2026',
      academicYear: '2026-2027',
      departmentId: department.id,
      status: SemesterStatus.OPEN,
      registrationFrom: new Date(),
      registrationTo: new Date(Date.now() + 30 * 86400000),
      submissionTo: new Date(Date.now() + 60 * 86400000),
      defenseFrom: new Date(Date.now() + 75 * 86400000),
      defenseTo: new Date(Date.now() + 80 * 86400000),
    },
  });

  const passwordHash = await bcrypt.hash('Password@123', 12);
  const accounts = [
    { email: 'admin@kltn.edu.vn', fullName: 'Quản trị viên hệ thống', role: RoleCode.ADMIN, code: 'ADMIN001', status: UserStatus.ACTIVE },
    { email: 'sinhvien@kltn.edu.vn', fullName: 'Nguyễn Minh Sinh', role: RoleCode.SINH_VIEN, code: 'SV2026001', eligible: true, credits: 125, gpa: 3.45, status: UserStatus.ACTIVE },
    { email: 'sinhvien2@kltn.edu.vn', fullName: 'Trần Thị Mai', role: RoleCode.SINH_VIEN, code: 'SV2026002', eligible: true, credits: 120, gpa: 3.20, status: UserStatus.ACTIVE },
    { email: 'sinhvien3@kltn.edu.vn', fullName: 'Lê Hoàng Nam', role: RoleCode.SINH_VIEN, code: 'SV2026003', eligible: true, credits: 118, gpa: 3.10, status: UserStatus.ACTIVE },
    { email: 'sinhvien4@kltn.edu.vn', fullName: 'Phạm Ngọc Lan', role: RoleCode.SINH_VIEN, code: 'SV2026004', eligible: true, credits: 115, gpa: 2.95, status: UserStatus.ACTIVE },
    { email: 'svchuadk@kltn.edu.vn', fullName: 'Vũ Văn Chưa Đủ ĐK', role: RoleCode.SINH_VIEN, code: 'SV2026005', eligible: false, credits: 90, gpa: 2.10, status: UserStatus.ACTIVE },
    { email: 'khoataikhoan@kltn.edu.vn', fullName: 'Đặng Khóa Tài Khoản', role: RoleCode.SINH_VIEN, code: 'SV_LOCKED', eligible: false, credits: 80, gpa: 1.80, status: UserStatus.LOCKED },
    { email: 'giangvien@kltn.edu.vn', fullName: 'Trần Văn Giảng', role: RoleCode.GIANG_VIEN, code: 'GV001', status: UserStatus.ACTIVE },
    { email: 'giangvien2@kltn.edu.vn', fullName: 'Nguyễn Văn Phản Biện', role: RoleCode.GIANG_VIEN, code: 'GV002', status: UserStatus.ACTIVE },
    { email: 'truongbomon@kltn.edu.vn', fullName: 'Lê Thị Trưởng', role: RoleCode.TRUONG_BO_MON, code: 'TBM001', status: UserStatus.ACTIVE },
    { email: 'quanly@kltn.edu.vn', fullName: 'Phạm Văn Quản', role: RoleCode.QUAN_LY_BO_MON, code: 'QL001', status: UserStatus.ACTIVE },
    // 11 Giảng viên hướng dẫn theo danh sách 88 đề tài từ file
    ...Object.entries(LECTURER_DATA).map(([name, meta]) => ({
      email: meta.email,
      fullName: name,
      role: RoleCode.GIANG_VIEN,
      code: meta.code,
      title: meta.title,
      departmentId: departmentIS.id,
      status: UserStatus.ACTIVE,
    })),
  ];

  const userMap = new Map<string, any>();
  for (const account of accounts) {
    const userStatus = account.status ?? UserStatus.ACTIVE;
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { fullName: account.fullName, status: userStatus, passwordHash },
      create: { email: account.email, fullName: account.fullName, passwordHash, status: userStatus },
    });
    userMap.set(account.email, user);
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleMap.get(account.role)! } },
      update: {},
      create: { userId: user.id, roleId: roleMap.get(account.role)! },
    });

    if (account.role === RoleCode.SINH_VIEN) {
      const isEligible = account.eligible ?? true;
      const credits = account.credits ?? 125;
      const gpaVal = account.gpa ?? 3.45;
      await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: { eligible: isEligible, creditsEarned: credits, gpa: gpaVal },
        create: {
          userId: user.id,
          studentCode: account.code,
          className: 'CNTT K2026',
          cohort: 2026,
          departmentId: department.id,
          creditsEarned: credits,
          gpa: gpaVal,
          eligible: isEligible,
        },
      });
    }

    if (
      account.role === RoleCode.GIANG_VIEN ||
      account.role === RoleCode.TRUONG_BO_MON ||
      account.role === RoleCode.QUAN_LY_BO_MON
    ) {
      const targetDeptId = (account as any).departmentId ?? departmentIS.id;
      const targetTitle =
        (account as any).title ??
        (account.role === RoleCode.TRUONG_BO_MON ? 'PGS. TS.' : 'ThS.');
      await prisma.lecturerProfile.upsert({
        where: { userId: user.id },
        update: { maxGroups: 10, departmentId: targetDeptId, title: targetTitle },
        create: {
          userId: user.id,
          lecturerCode: account.code,
          title: targetTitle,
          specialization: 'Hệ thống thông tin',
          departmentId: targetDeptId,
          maxGroups: 10,
        },
      });
    }
  }

  // Tiêu chí điểm (10 tiêu chí chuẩn LO KLTN)
  const tenLoCriteria = [
    { code: 'TC01', name: 'Phân tích vấn đề và mô hình hóa được yêu cầu của đề tài.', weight: 10, maxScore: 10, active: true },
    { code: 'TC02', name: 'Áp dụng các nguyên tắc, phương pháp chuyên môn để xác định được giải pháp cho đề tài.', weight: 10, maxScore: 10, active: true },
    { code: 'TC03', name: 'Thiết kế được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.', weight: 10, maxScore: 10, active: true },
    { code: 'TC04', name: 'Hiện thực được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.', weight: 10, maxScore: 10, active: true },
    { code: 'TC05', name: 'Đánh giá được một hệ thống, quy trình đáp ứng yêu cầu của đề tài.', weight: 10, maxScore: 10, active: true },
    { code: 'TC06', name: 'Thuyết trình hiệu quả trong các lĩnh vực chuyên môn của đề tài.', weight: 10, maxScore: 10, active: true },
    { code: 'TC07', name: 'Thu thập yêu cầu từ các bên liên quan bằng các kỹ thuật phù hợp.', weight: 10, maxScore: 10, active: true },
    { code: 'TC08', name: 'Viết được báo cáo khóa luận tốt nghiệp.', weight: 10, maxScore: 10, active: true },
    { code: 'TC09', name: 'Chứng tỏ được khả năng làm việc hiệu quả với các thành viên trong nhóm và phối hợp với các bên liên quan.', weight: 10, maxScore: 10, active: true },
    { code: 'TC10', name: 'Khả năng hỗ trợ triển khai và vận hành hệ thống thông tin.', weight: 10, maxScore: 10, active: true },
  ];
  for (const item of tenLoCriteria) {
    await prisma.scoreCriterion.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
  }

  // Cấu hình hệ thống
  await prisma.systemConfig.upsert({
    where: { key_semesterId_departmentId: { key: 'MAX_GROUP_SIZE', semesterId: semester.id, departmentId: department.id } },
    update: { value: 3 },
    create: {
      key: 'MAX_GROUP_SIZE',
      value: 3,
      description: 'Số sinh viên tối đa mỗi nhóm',
      semesterId: semester.id,
      departmentId: department.id,
    },
  });

  await prisma.systemConfig.upsert({
    where: { key_semesterId_departmentId: { key: 'MIN_CREDITS_REQUIRED', semesterId: semester.id, departmentId: department.id } },
    update: { value: 110 },
    create: {
      key: 'MIN_CREDITS_REQUIRED',
      value: 110,
      description: 'Số tín chỉ tích lũy tối thiểu để đủ điều kiện làm KLTN',
      semesterId: semester.id,
      departmentId: department.id,
    },
  });

  // Seed toàn bộ 88 đề tài theo danh sách từ file PDF
  const newTopicUuids = RAW_TOPICS.map((t) => hexToUuid(t.approvalCode));

  // Dọn dẹp liên kết trỏ tới đề tài cũ không nằm trong 88 đề tài mới
  await prisma.group.updateMany({
    where: { topicId: { notIn: newTopicUuids } },
    data: { topicId: null },
  });
  await prisma.registration.deleteMany({
    where: { topicId: { notIn: newTopicUuids } },
  });
  await prisma.topicApproval.deleteMany({
    where: { topicId: { notIn: newTopicUuids } },
  });
  await prisma.chatMessage.deleteMany({
    where: { topicId: { notIn: newTopicUuids } },
  });
  await prisma.topic.deleteMany({
    where: { id: { notIn: newTopicUuids } },
  });

  // Upsert 88 đề tài mới
  for (const item of RAW_TOPICS) {
    const topicId = hexToUuid(item.approvalCode);
    const lecturerMeta = LECTURER_DATA[item.lecturerName];
    const lecturerUser = lecturerMeta ? userMap.get(lecturerMeta.email) : userMap.get('giangvien@kltn.edu.vn');

    await prisma.topic.upsert({
      where: { id: topicId },
      update: {
        title: item.title,
        summary: item.summary,
        objectives: item.objectives,
        technologies: item.technologies,
        capacity: 2,
        status: TopicStatus.APPROVED,
        isHidden: false,
        ownerId: lecturerUser.id,
        departmentId: departmentIS.id,
        semesterId: semester.id,
      },
      create: {
        id: topicId,
        title: item.title,
        summary: item.summary,
        objectives: item.objectives,
        technologies: item.technologies,
        capacity: 2,
        status: TopicStatus.APPROVED,
        isHidden: false,
        ownerId: lecturerUser.id,
        departmentId: departmentIS.id,
        semesterId: semester.id,
      },
    });
  }

  // Dọn sạch toàn bộ dữ liệu phát sinh để bắt đầu từ lúc mới mở học kỳ (Bước 1: Đăng ký đề tài)
  await prisma.$transaction([
    prisma.score.deleteMany({}),
    prisma.defenseSchedule.deleteMany({}),
    prisma.defenseCommitteeMember.deleteMany({}),
    prisma.defenseCommittee.deleteMany({}),
    prisma.reviewerAssignment.deleteMany({}),
    prisma.feedback.deleteMany({}),
    prisma.submission.deleteMany({}),
    prisma.progressReport.deleteMany({}),
    prisma.appointment.deleteMany({}),
    prisma.chatMessage.deleteMany({}),
    prisma.groupMember.deleteMany({}),
    prisma.registration.deleteMany({}),
    prisma.topicProposal.deleteMany({}),
    prisma.group.deleteMany({}),
    prisma.notification.deleteMany({}),
    prisma.auditLog.deleteMany({}),
  ]);

  console.log('Seed completed successfully. Đã đặt lại toàn bộ dữ liệu về trạng thái Mới mở học kỳ (88 đề tài trống 100%).');
  console.log('Demo accounts (mật khẩu chung: Password@123):');
  console.log(' - Sinh viên: sinhvien@kltn.edu.vn hoặc SV2026001');
  console.log(' - Giảng viên hệ thống: giangvien@kltn.edu.vn');
  console.log(' - 11 Giảng viên hướng dẫn:');
  for (const [name, meta] of Object.entries(LECTURER_DATA)) {
    console.log(`   + ${name}: ${meta.email}`);
  }
}

main().finally(() => prisma.$disconnect());
