import { PrismaClient, RoleCode, UserStatus, TopicStatus } from '@prisma/client';
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
  console.log('--- BẮT ĐẦU ĐỔI TOÀN BỘ ĐỀ TÀI THEO FILE PDF (88 ĐỀ TÀI) ---');

  // 1. Lấy role GIANG_VIEN
  const gvRole = await prisma.role.findUnique({ where: { code: RoleCode.GIANG_VIEN } });
  if (!gvRole) throw new Error('Role GIANG_VIEN không tồn tại');

  // 2. Upsert bộ môn IS (Hệ thống thông tin)
  const departmentIS = await prisma.department.upsert({
    where: { code: 'IS' },
    update: { name: 'Hệ thống thông tin', description: 'Bộ môn Hệ thống thông tin' },
    create: { code: 'IS', name: 'Hệ thống thông tin', description: 'Bộ môn Hệ thống thông tin' },
  });
  console.log(`Bộ môn IS: ${departmentIS.id} (${departmentIS.name})`);

  // 3. Lấy hoặc tạo kỳ KLTN mở
  let semester = await prisma.semester.findFirst({
    where: { code: '2026-KLTN-1' },
  });
  if (!semester) {
    semester = await prisma.semester.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }
  if (!semester) throw new Error('Không tìm thấy kỳ KLTN');
  console.log(`Học kỳ áp dụng: ${semester.code} (${semester.id})`);

  // 4. Tạo/Cập nhật 11 giảng viên hướng dẫn
  const passwordHash = await bcrypt.hash('Password@123', 12);
  const lecturerMap = new Map<string, any>();

  for (const [name, meta] of Object.entries(LECTURER_DATA)) {
    const user = await prisma.user.upsert({
      where: { email: meta.email },
      update: { fullName: name, status: UserStatus.ACTIVE },
      create: {
        email: meta.email,
        fullName: name,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: gvRole.id } },
      update: {},
      create: { userId: user.id, roleId: gvRole.id },
    });

    await prisma.lecturerProfile.upsert({
      where: { userId: user.id },
      update: {
        title: meta.title,
        departmentId: departmentIS.id,
        specialization: 'Hệ thống thông tin',
        maxGroups: 10,
      },
      create: {
        userId: user.id,
        lecturerCode: meta.code,
        title: meta.title,
        departmentId: departmentIS.id,
        specialization: 'Hệ thống thông tin',
        maxGroups: 10,
      },
    });

    lecturerMap.set(name, user);
    console.log(`Đã chuẩn bị GVHD: ${name} (${meta.email})`);
  }

  // 5. Chuẩn bị danh sách ID 88 đề tài mới
  const newTopicUuids = RAW_TOPICS.map((t) => hexToUuid(t.approvalCode));
  const newTopicSet = new Set(newTopicUuids);

  // 6. Xử lý các liên kết đến đề tài cũ để tránh vi phạm khóa ngoại
  // Đổi các group và registration trỏ đến đề tài không nằm trong danh sách mới
  console.log('Dọn dẹp và cập nhật liên kết đề tài cũ...');

  // Cập nhật demo group nếu có
  // Set topicId = null cho tất cả các group đang trỏ vào topic cũ
  await prisma.group.updateMany({
    where: {
      topicId: { notIn: newTopicUuids },
    },
    data: {
      topicId: null,
    },
  });

  // Xóa các registration trỏ vào topic cũ
  await prisma.registration.deleteMany({
    where: {
      topicId: { notIn: newTopicUuids },
    },
  });

  // Xóa các topicApproval trỏ vào topic cũ
  await prisma.topicApproval.deleteMany({
    where: {
      topicId: { notIn: newTopicUuids },
    },
  });

  // Xóa các chatMessages trỏ vào topic cũ
  await prisma.chatMessage.deleteMany({
    where: {
      topicId: { notIn: newTopicUuids },
    },
  });

  // Xóa toàn bộ đề tài cũ không nằm trong 88 đề tài mới
  const deletedOld = await prisma.topic.deleteMany({
    where: {
      id: { notIn: newTopicUuids },
    },
  });
  console.log(`Đã xóa ${deletedOld.count} đề tài cũ không thuộc danh sách.`);

  // 7. Upsert 88 đề tài mới
  console.log('Tiến hành nạp 88 đề tài từ file PDF...');
  let count = 0;
  for (const item of RAW_TOPICS) {
    const topicId = hexToUuid(item.approvalCode);
    const lecturer = lecturerMap.get(item.lecturerName);
    if (!lecturer) {
      throw new Error(`Không tìm thấy GVHD: ${item.lecturerName} cho đề tài STT ${item.stt}`);
    }

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
        rejectionReason: null,
        ownerId: lecturer.id,
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
        ownerId: lecturer.id,
        departmentId: departmentIS.id,
        semesterId: semester.id,
      },
    });
    count++;
  }

  // 8. Đảm bảo demo sinh viên được đăng ký vào đề tài 1
  const firstTopicId = newTopicUuids[0];
  const sv = await prisma.user.findUnique({ where: { email: 'sinhvien@kltn.edu.vn' } });
  if (sv) {
    const studentProfile = await prisma.studentProfile.findUnique({ where: { userId: sv.id } });
    if (studentProfile) {
      const g = await prisma.group.upsert({
        where: { code: 'NHOM-CNTT-01' },
        update: { topicId: firstTopicId },
        create: {
          code: 'NHOM-CNTT-01',
          name: 'Nhóm KLTN Đề tài 1',
          semesterId: semester.id,
          topicId: firstTopicId,
          status: 'ACTIVE',
          midtermStatus: 'CONTINUE',
        },
      });

      await prisma.groupMember.upsert({
        where: { groupId_studentId: { groupId: g.id, studentId: studentProfile.id } },
        update: {},
        create: { groupId: g.id, studentId: studentProfile.id, isLeader: true },
      });

      await prisma.registration.upsert({
        where: { id: '00000000-0000-0000-0000-000000000010' },
        update: { topicId: firstTopicId, groupId: g.id },
        create: {
          id: '00000000-0000-0000-0000-000000000010',
          studentId: studentProfile.id,
          semesterId: semester.id,
          topicId: firstTopicId,
          groupId: g.id,
          status: 'APPROVED',
          decidedAt: new Date(),
        },
      });
    }
  }

  const finalCount = await prisma.topic.count();
  console.log(`=== ĐỔI ĐỀ TÀI HOÀN TẤT: Hiện có ${finalCount} đề tài trong hệ thống ===`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi đổi đề tài:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
