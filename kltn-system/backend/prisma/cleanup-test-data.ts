import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanTestData() {
  console.log('=== BẮT ĐẦU QUÉT VÀ DỌN DẸP DỮ LIỆU TEST / RÁC AUTOTEST ===');

  // =========================================================================
  // 1. DỌN SẠCH 7 ĐỢT HỌC KỲ TEST (SEM_DEF_179000...)
  // =========================================================================
  const testSemesters = await prisma.semester.findMany({
    where: {
      OR: [
        { code: { startsWith: 'SEM_DEF_' } },
        { name: { contains: 'Thử nghiệm Bảo vệ' } },
        { name: { contains: '179000' } },
      ],
    },
    select: { id: true, code: true, name: true },
  });

  console.log(`[INFO] Phát hiện ${testSemesters.length} đợt học kỳ test cần dọn sạch:`);
  testSemesters.forEach((s) => console.log(`   - ${s.code}: ${s.name}`));

  if (testSemesters.length > 0) {
    const testSemIds = testSemesters.map((s) => s.id);

    // Xóa liên kết điểm, phản biện, nộp bài, thành viên trong các nhóm thuộc kỳ test
    const groupsInTestSem = await prisma.group.findMany({
      where: { semesterId: { in: testSemIds } },
      select: { id: true },
    });
    const testGroupIds = groupsInTestSem.map((g) => g.id);

    if (testGroupIds.length > 0) {
      await prisma.score.deleteMany({ where: { groupId: { in: testGroupIds } } });
      await prisma.reviewerAssignment.deleteMany({ where: { groupId: { in: testGroupIds } } });
      await prisma.feedback.deleteMany({ where: { submission: { groupId: { in: testGroupIds } } } });
      await prisma.submission.deleteMany({ where: { groupId: { in: testGroupIds } } });
      await prisma.groupMember.deleteMany({ where: { groupId: { in: testGroupIds } } });
      await prisma.group.deleteMany({ where: { id: { in: testGroupIds } } });
      console.log(`   + Đã xóa ${testGroupIds.length} nhóm thuộc các học kỳ test.`);
    }

    // Xóa lịch bảo vệ và hội đồng
    await prisma.defenseSchedule.deleteMany({ where: { semesterId: { in: testSemIds } } });
    await prisma.registration.deleteMany({ where: { semesterId: { in: testSemIds } } });
    await prisma.progressReport.deleteMany({ where: { semesterId: { in: testSemIds } } });
    await prisma.systemConfig.deleteMany({
      where: {
        OR: [
          { semesterId: { in: testSemIds } },
          { key: { contains: 'SEM_DEF_' } },
        ],
      },
    });
    await prisma.topicProposal.deleteMany({ where: { semesterId: { in: testSemIds } } });
    await prisma.lecturerQuota.deleteMany({ where: { semesterId: { in: testSemIds } } });

    // Xóa đề tài thuộc các học kỳ test
    const testTopics = await prisma.topic.findMany({
      where: { semesterId: { in: testSemIds } },
      select: { id: true },
    });
    if (testTopics.length > 0) {
      const topicIds = testTopics.map((t) => t.id);
      await prisma.topicApproval.deleteMany({ where: { topicId: { in: topicIds } } });
      await prisma.topic.deleteMany({ where: { id: { in: topicIds } } });
    }

    // Xóa các học kỳ test
    const deletedSems = await prisma.semester.deleteMany({
      where: { id: { in: testSemIds } },
    });
    console.log(`[OK] Đã xóa thành công ${deletedSems.count} đợt học kỳ test.`);
  }

  // =========================================================================
  // 2. XÓA HỘI ĐỒNG BẢO VỆ TEST CÒN SÓT LẠI
  // =========================================================================
  const testCommittees = await prisma.defenseCommittee.findMany({
    where: {
      OR: [
        { name: { contains: '17' } },
        { name: { contains: 'Test' } },
        { name: { contains: 'test' } },
      ],
    },
    select: { id: true, name: true },
  });

  if (testCommittees.length > 0) {
    const comIds = testCommittees.map((c) => c.id);
    await prisma.defenseSchedule.deleteMany({ where: { committeeId: { in: comIds } } });
    await prisma.defenseCommitteeMember.deleteMany({ where: { committeeId: { in: comIds } } });
    await prisma.defenseCommittee.deleteMany({ where: { id: { in: comIds } } });
    console.log(`[OK] Đã xóa ${testCommittees.length} hội đồng bảo vệ test.`);
  }

  // =========================================================================
  // 3. DỌN SẠCH CÁC SINH VIÊN TEST (SV_1789..., SV_SC_..., SV_UL_..., TEST_SV_...) VÀ USER TEST
  // =========================================================================
  // Danh sách sinh viên chính thức hợp lệ cần bảo vệ không xóa
  const protectedStudentCodes = [
    'SV2026001',
    'SV2026002',
    'SV2026003',
    'SV2026004',
    'SV2026005',
    'SV_LOCKED',
    'SV_REG_001',
    'SV_REG_002',
    'SV_REG_003',
    'SV_PROP_001',
    'SV_CANCEL_01',
  ];

  // Tìm tất cả studentProfile test
  const testStudentProfiles = await prisma.studentProfile.findMany({
    where: {
      AND: [
        { studentCode: { notIn: protectedStudentCodes } },
        {
          OR: [
            { studentCode: { startsWith: 'SV_1789' } },
            { studentCode: { startsWith: 'SV_SC_' } },
            { studentCode: { startsWith: 'SV_UL_' } },
            { studentCode: { startsWith: 'TEST_SV_' } },
            { studentCode: { contains: '17' } },
            { creditsEarned: 0 },
          ],
        },
      ],
    },
    include: { user: true },
  });

  const testStudentUserIds = testStudentProfiles.map((s) => s.userId).filter(Boolean) as string[];
  const testStudentProfileIds = testStudentProfiles.map((s) => s.id);

  console.log(`[INFO] Phát hiện ${testStudentProfiles.length} sinh viên test rác cần dọn dẹp:`);
  testStudentProfiles.forEach((s) =>
    console.log(`   - MSSV: ${s.studentCode} | Tín chỉ: ${s.creditsEarned} | Đủ ĐK: ${s.eligible} | User: ${s.user?.email}`)
  );

  // Tìm các giảng viên test rác
  const altProfiles = await prisma.lecturerProfile.findMany({
    where: {
      OR: [
        { lecturerCode: 'TBM001_ALT' },
        { lecturerCode: { startsWith: 'HOD_UL_' } },
        { lecturerCode: { startsWith: 'GV_UL_' } },
        { lecturerCode: { startsWith: 'HOD_SC_' } },
        { lecturerCode: { startsWith: 'GV_SC_' } },
        { lecturerCode: { startsWith: 'GVA_' } },
        { lecturerCode: { startsWith: 'GVB_' } },
      ],
    },
    select: { userId: true },
  });
  const altUserIds = altProfiles.map((p) => p.userId).filter(Boolean) as string[];

  // Pattern tìm kiếm tất cả user test theo email
  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true },
  });

  const testEmailPattern =
    /(^sv_1789|^sv_score_|^sv_unlock_|^sv_test_|^test_sv_|\d{10,}@kltn\.edu\.vn|^hod_|^gv_score_|^gv_unlock_|^gv_b_|^gv_a_|^gv_sc_|^test_)/i;

  const testUserIdsSet = new Set<string>([...testStudentUserIds, ...altUserIds]);

  for (const u of allUsers) {
    if (
      testEmailPattern.test(u.email) ||
      u.email.includes('truongbomôn') ||
      u.email.includes('_17')
    ) {
      // Bảo vệ các tài khoản demo chuẩn
      if (
        ![
          'sinhvien@kltn.edu.vn',
          'sinhvien2@kltn.edu.vn',
          'sinhvien3@kltn.edu.vn',
          'sinhvien4@kltn.edu.vn',
          'svchuadk@kltn.edu.vn',
          'khoataikhoan@kltn.edu.vn',
          'giangvien@kltn.edu.vn',
          'giangvien2@kltn.edu.vn',
          'truongbomon@kltn.edu.vn',
          'quanly@kltn.edu.vn',
          'admin@kltn.edu.vn',
        ].includes(u.email.toLowerCase())
      ) {
        testUserIdsSet.add(u.id);
      }
    }
  }

  const allTestUserIds = Array.from(testUserIdsSet);
  console.log(`[INFO] Tổng số tài khoản test rác cần xóa triệt để: ${allTestUserIds.length}`);

  if (allTestUserIds.length > 0 || testStudentProfileIds.length > 0) {
    // Xóa điểm của sinh viên/người chấm test
    await prisma.score.deleteMany({
      where: {
        scorerId: { in: allTestUserIds },
      },
    });

    // Xóa feedback của user test
    await prisma.feedback.deleteMany({ where: { authorId: { in: allTestUserIds } } });

    // Xóa reviewer assignments
    await prisma.reviewerAssignment.deleteMany({
      where: { lecturer: { userId: { in: allTestUserIds } } },
    });

    // Xóa group members của sinh viên test
    await prisma.groupMember.deleteMany({
      where: {
        OR: [
          { studentId: { in: testStudentProfileIds } },
          { student: { userId: { in: allTestUserIds } } },
        ],
      },
    });

    // Xóa đăng ký đề tài của sinh viên test
    await prisma.registration.deleteMany({
      where: {
        OR: [
          { studentId: { in: testStudentProfileIds } },
          { student: { userId: { in: allTestUserIds } } },
        ],
      },
    });

    // Xóa bài nộp
    await prisma.submission.deleteMany({ where: { submittedBy: { in: allTestUserIds } } });

    // Xóa topic đề tài của user test
    const userTopics = await prisma.topic.findMany({
      where: { ownerId: { in: allTestUserIds } },
      select: { id: true },
    });
    if (userTopics.length > 0) {
      const uTopicIds = userTopics.map((t) => t.id);
      await prisma.group.deleteMany({ where: { topicId: { in: uTopicIds } } });
      await prisma.registration.deleteMany({ where: { topicId: { in: uTopicIds } } });
      await prisma.topicApproval.deleteMany({ where: { topicId: { in: uTopicIds } } });
      await prisma.chatMessage.deleteMany({ where: { topicId: { in: uTopicIds } } });
      await prisma.topic.deleteMany({ where: { id: { in: uTopicIds } } });
    }

    // Xóa chat messages
    await prisma.chatMessage.deleteMany({ where: { senderId: { in: allTestUserIds } } });

    // Xóa profiles
    await prisma.studentProfile.deleteMany({
      where: {
        OR: [
          { id: { in: testStudentProfileIds } },
          { userId: { in: allTestUserIds } },
        ],
      },
    });

    await prisma.lecturerQuota.deleteMany({ where: { lecturer: { userId: { in: allTestUserIds } } } });
    await prisma.lecturerProfile.deleteMany({ where: { userId: { in: allTestUserIds } } });

    // Xóa notifications, audit logs, user roles
    await prisma.notification.deleteMany({ where: { userId: { in: allTestUserIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: allTestUserIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: allTestUserIds } } });

    // Cuối cùng xóa User
    const deletedUsers = await prisma.user.deleteMany({ where: { id: { in: allTestUserIds } } });
    console.log(`[OK] Đã xóa thành công ${deletedUsers.count} người dùng test rác.`);
  }

  // =========================================================================
  // 4. CHUẨN HÓA CỜ ĐỦ ĐIỀU KIỆN (ELIGIBLE) CHO TẤT CẢ SINH VIÊN CÒN LẠI
  // =========================================================================
  // Bất kỳ sinh viên nào có tín chỉ tích lũy < 110 thì BẮT BUỘC eligible = false!
  const fixedStudents = await prisma.studentProfile.updateMany({
    where: {
      creditsEarned: { lt: 110 },
      eligible: true,
    },
    data: { eligible: false },
  });
  if (fixedStudents.count > 0) {
    console.log(`[OK] Đã sửa cờ Đủ điều kiện thành false cho ${fixedStudents.count} sinh viên có < 110 tín chỉ.`);
  }

  // Kiểm tra lại danh sách sinh viên hiện tại trong hệ thống
  const remainingStudents = await prisma.studentProfile.findMany({
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { studentCode: 'asc' },
  });
  const eligibleCount = remainingStudents.filter((s) => s.eligible).length;

  console.log('\n=== KẾT QUẢ SAU KHI DỌN DẸP ===');
  console.log(`- Tổng số sinh viên còn lại: ${remainingStudents.length}`);
  console.log(`- Sinh viên đủ điều kiện: ${eligibleCount}/${remainingStudents.length}`);
  remainingStudents.forEach((s) => {
    console.log(
      `   * ${s.studentCode} | ${s.user?.fullName || 'N/A'} (${s.user?.email}) | Tín chỉ: ${s.creditsEarned} | Đủ ĐK: ${s.eligible}`
    );
  });

  const remainingSemesters = await prisma.semester.findMany({
    select: { id: true, code: true, name: true, status: true },
  });
  console.log(`- Tổng số học kỳ còn lại: ${remainingSemesters.length}`);
  remainingSemesters.forEach((s) => console.log(`   * ${s.code} | ${s.name} | ${s.status}`));

  console.log('\n--- HOÀN TẤT DỌN DẸP TOÀN BỘ DỮ LIỆU RÁC AUTOTEST THÀNH CÔNG ---');
}

cleanTestData()
  .catch((err) => {
    console.error('Lỗi khi chạy dọn dẹp:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
