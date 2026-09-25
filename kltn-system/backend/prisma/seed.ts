import { PrismaClient, RoleCode, UserStatus, SemesterStatus, TopicStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const roles = [
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
    { email: 'sinhvien@kltn.edu.vn', fullName: 'Nguyễn Minh Sinh', role: RoleCode.SINH_VIEN, code: 'SV2026001', eligible: true, credits: 125, gpa: 3.45, status: UserStatus.ACTIVE },
    { email: 'sinhvien2@kltn.edu.vn', fullName: 'Trần Thị Mai (Chưa đủ điều kiện KLTN)', role: RoleCode.SINH_VIEN, code: 'SV2026002', eligible: false, credits: 95, gpa: 2.10, status: UserStatus.ACTIVE },
    { email: 'khoataikhoan@kltn.edu.vn', fullName: 'Đặng Khóa Tài Khoản', role: RoleCode.SINH_VIEN, code: 'SV_LOCKED', eligible: false, credits: 80, gpa: 1.80, status: UserStatus.LOCKED },
    { email: 'giangvien@kltn.edu.vn', fullName: 'Trần Văn Giảng', role: RoleCode.GIANG_VIEN, code: 'GV001', status: UserStatus.ACTIVE },
    { email: 'giangvien2@kltn.edu.vn', fullName: 'Nguyễn Văn Phản Biện', role: RoleCode.GIANG_VIEN, code: 'GV002', status: UserStatus.ACTIVE },
    { email: 'truongbomon@kltn.edu.vn', fullName: 'Lê Thị Trưởng', role: RoleCode.TRUONG_BO_MON, code: 'TBM001', status: UserStatus.ACTIVE },
    { email: 'truongbomôn@kltn.edu.vn', fullName: 'Lê Thị Trưởng', role: RoleCode.TRUONG_BO_MON, code: 'TBM001_ALT', status: UserStatus.ACTIVE },
    { email: 'quanly@kltn.edu.vn', fullName: 'Phạm Văn Quản', role: RoleCode.QUAN_LY_BO_MON, code: 'QL001', status: UserStatus.ACTIVE },
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

    if (account.role === RoleCode.GIANG_VIEN || account.role === RoleCode.TRUONG_BO_MON) {
      await prisma.lecturerProfile.upsert({
        where: { userId: user.id },
        update: { maxGroups: 5 },
        create: {
          userId: user.id,
          lecturerCode: account.code,
          title: account.role === RoleCode.TRUONG_BO_MON ? 'PGS. TS.' : 'ThS.',
          specialization: 'Khoa học máy tính & Trí tuệ nhân tạo',
          departmentId: department.id,
          maxGroups: 5,
        },
      });
    }
  }

  // Tiêu chí điểm (10 tiêu chí chuẩn KLTN)
  await prisma.scoreCriterion.createMany({
    data: [
      { code: 'TC01', name: 'Tính cấp thiết và mục tiêu của đề tài', weight: 10, maxScore: 10, active: true },
      { code: 'TC02', name: 'Khảo sát tài liệu và tổng quan nghiên cứu liên quan', weight: 10, maxScore: 10, active: true },
      { code: 'TC03', name: 'Cơ sở lý thuyết và phương pháp nghiên cứu', weight: 10, maxScore: 10, active: true },
      { code: 'TC04', name: 'Phân tích yêu cầu và thiết kế kiến trúc hệ thống', weight: 10, maxScore: 10, active: true },
      { code: 'TC05', name: 'Hiện thực hóa sản phẩm và mức độ hoàn thiện giải pháp', weight: 15, maxScore: 10, active: true },
      { code: 'TC06', name: 'Thử nghiệm, kiểm thử và đánh giá kết quả', weight: 10, maxScore: 10, active: true },
      { code: 'TC07', name: 'Tính thực tiễn, tính sáng tạo và khả năng ứng dụng', weight: 10, maxScore: 10, active: true },
      { code: 'TC08', name: 'Bố cục và quy cách trình bày báo cáo khóa luận', weight: 10, maxScore: 10, active: true },
      { code: 'TC09', name: 'Kỹ năng thuyết trình và tác phong báo cáo', weight: 10, maxScore: 10, active: true },
      { code: 'TC10', name: 'Khả năng tranh luận phản biện và trả lời câu hỏi', weight: 5, maxScore: 10, active: true },
      { code: 'CONTENT', name: 'Nội dung chuyên môn', weight: 40, maxScore: 10, active: true },
      { code: 'IMPLEMENTATION', name: 'Triển khai sản phẩm', weight: 30, maxScore: 10, active: true },
      { code: 'PRESENTATION', name: 'Trình bày và bảo vệ', weight: 30, maxScore: 10, active: true },
    ],
    skipDuplicates: true,
  });

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

  // Seed sample topics
  const gv = userMap.get('giangvien@kltn.edu.vn');
  if (gv) {
    const topic1 = await prisma.topic.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Nghiên cứu và xây dựng hệ thống gợi ý học tập thích ứng ứng dụng AI',
        summary: 'Xây dựng thuật toán phân tích hành vi học tập và gợi ý tài liệu học tập phù hợp theo năng lực cá nhân.',
        objectives: 'Hoàn thiện mô hình học máy gợi ý và website tích hợp NestJS + React.',
        technologies: 'NestJS, React, Python, FastAPI, PyTorch, PostgreSQL',
        capacity: 2,
        status: TopicStatus.APPROVED,
        ownerId: gv.id,
        departmentId: department.id,
        semesterId: semester.id,
      },
    });

    await prisma.topic.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        title: 'Hệ thống Quản lý Chuỗi cung ứng Dược phẩm sử dụng Blockchain Hyperledger',
        summary: 'Ứng dụng công nghệ sổ cái phân tán bảo đảm truy xuất nguồn gốc và phòng chống thuốc giả.',
        objectives: 'Xây dựng smart contracts và cổng theo dõi hành trình vận chuyển dược phẩm.',
        technologies: 'Hyperledger Fabric, Node.js, React, Docker',
        capacity: 3,
        status: TopicStatus.APPROVED,
        ownerId: gv.id,
        departmentId: department.id,
        semesterId: semester.id,
      },
    });

    // Sample group & members
    const sv = userMap.get('sinhvien@kltn.edu.vn');
    if (sv) {
      const studentProfile = await prisma.studentProfile.findUnique({ where: { userId: sv.id } });
      if (studentProfile) {
        const group = await prisma.group.upsert({
          where: { code: 'NHOM-CNTT-01' },
          update: {},
          create: {
            code: 'NHOM-CNTT-01',
            name: 'Nhóm AI Gợi ý Học tập',
            semesterId: semester.id,
            topicId: topic1.id,
            status: 'ACTIVE',
            midtermStatus: 'CONTINUE',
          },
        });

        await prisma.groupMember.upsert({
          where: { groupId_studentId: { groupId: group.id, studentId: studentProfile.id } },
          update: {},
          create: { groupId: group.id, studentId: studentProfile.id, isLeader: true },
        });

        await prisma.registration.upsert({
          where: { id: '00000000-0000-0000-0000-000000000010' },
          update: {},
          create: {
            id: '00000000-0000-0000-0000-000000000010',
            studentId: studentProfile.id,
            semesterId: semester.id,
            topicId: topic1.id,
            groupId: group.id,
            status: 'APPROVED',
            decidedAt: new Date(),
          },
        });
      }
    }
  }

  console.log('Seed completed successfully. Demo accounts (all with Password@123):');
  console.log(' - Sinh viên: sinhvien@kltn.edu.vn hoặc SV2026001');
  console.log(' - Giảng viên: giangvien@kltn.edu.vn');
  console.log(' - Trưởng bộ môn: truongbomon@kltn.edu.vn (hoặc truongbomôn@kltn.edu.vn)');
  console.log(' - Quản lý bộ môn: quanly@kltn.edu.vn');
}

main().finally(() => prisma.$disconnect());
