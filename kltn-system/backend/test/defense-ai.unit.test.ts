import { DefenseAiService } from '../src/modules/defense/defense-ai.service';

async function runUnitTest() {
  console.log('--- BẮT ĐẦU UNIT TEST DEFENSE AI SERVICE (MOCK DATA) ---');

  // Tạo mock prisma
  const mockPrisma: any = {
    systemConfig: {
      findFirst: async () => null,
    },
    topic: {
      findFirst: async () => null,
      findUnique: async () => ({
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Xây dựng hệ thống thị giác máy tính nhận diện bệnh trên cây trồng bằng YOLO và PyTorch',
        summary: 'Đề tài ứng dụng mô hình học sâu (Deep Learning) nhận diện và phân loại bệnh cây trồng qua hình ảnh',
        objectives: 'Huấn luyện mô hình YOLOv8 trên tập dữ liệu ảnh và triển khai ứng dụng web nhận diện tự động',
        technologies: 'Python, PyTorch, YOLOv8, OpenCV, FastAPI, React',
        ownerId: 'advisor-user-id',
        owner: {
          id: 'advisor-user-id',
          fullName: 'TS. Nguyễn Hướng Dẫn',
          email: 'huongdan@kltn.edu.vn',
          lecturerProfile: { id: 'advisor-profile-id' },
        },
        departmentId: 'dept-cntt',
        semesterId: 'sem-2026',
      }),
      findMany: async () => [
        {
          ownerId: 'lec-1-user',
          title: 'Phát hiện đối tượng trong video sử dụng OpenCV và Deep Learning',
          technologies: 'Python, OpenCV, PyTorch, YOLO',
          summary: 'Nghiên cứu thị giác máy tính',
        },
        {
          ownerId: 'lec-2-user',
          title: 'Phát triển hệ thống web phân tán với microservices và Docker',
          technologies: 'NestJS, React, Docker, Kubernetes',
          summary: 'Kiến trúc hệ thống phần mềm',
        },
        {
          ownerId: 'advisor-user-id',
          title: 'Đề tài của GVHD',
          technologies: 'Python',
          summary: 'Summary',
        },
      ],
    },
    lecturerProfile: {
      findMany: async () => [
        {
          id: 'advisor-profile-id',
          userId: 'advisor-user-id',
          lecturerCode: 'GV_ADV',
          title: 'TS.',
          specialization: 'Trí tuệ nhân tạo, Thị giác máy tính',
          departmentId: 'dept-cntt',
          user: {
            id: 'advisor-user-id',
            fullName: 'TS. Nguyễn Hướng Dẫn',
            email: 'huongdan@kltn.edu.vn',
            status: 'ACTIVE',
          },
          department: { name: 'Công nghệ thông tin' },
          quotas: [{ maxGroups: 5 }],
        },
        {
          id: 'lec-1-profile',
          userId: 'lec-1-user',
          lecturerCode: 'GV_BINH',
          title: 'TS.',
          specialization: 'Trí tuệ nhân tạo, Học sâu, Thị giác máy tính',
          departmentId: 'dept-cntt',
          user: {
            id: 'lec-1-user',
            fullName: 'TS. Nguyễn Thị Thanh Bình',
            email: 'binh@kltn.edu.vn',
            status: 'ACTIVE',
          },
          department: { name: 'Công nghệ thông tin' },
          quotas: [{ maxGroups: 5 }],
        },
        {
          id: 'lec-2-profile',
          userId: 'lec-2-user',
          lecturerCode: 'GV_NAM',
          title: 'ThS.',
          specialization: 'Công nghệ phần mềm, Hệ thống phân tán, Web Fullstack',
          departmentId: 'dept-cntt',
          user: {
            id: 'lec-2-user',
            fullName: 'ThS. Huỳnh Nam',
            email: 'nam@kltn.edu.vn',
            status: 'ACTIVE',
          },
          department: { name: 'Công nghệ thông tin' },
          quotas: [{ maxGroups: 5 }],
        },
        {
          id: 'lec-3-profile',
          userId: 'lec-3-user',
          lecturerCode: 'GV_HIEN',
          title: 'ThS.',
          specialization: 'Hệ thống thông tin, Cơ sở dữ liệu',
          departmentId: 'dept-cntt',
          user: {
            id: 'lec-3-user',
            fullName: 'ThS. Lê Trọng Hiền',
            email: 'hien@kltn.edu.vn',
            status: 'ACTIVE',
          },
          department: { name: 'Công nghệ thông tin' },
          quotas: [{ maxGroups: 5 }],
        },
      ],
    },
    reviewerAssignment: {
      groupBy: async () => [
        { lecturerId: 'lec-1-profile', _count: { id: 1 } },
        { lecturerId: 'lec-2-profile', _count: { id: 2 } },
      ],
    },
    semester: {
      findUnique: async () => ({
        id: 'sem-2026',
        code: '2026-KLTN-1',
        departmentId: 'dept-cntt',
        department: { id: 'dept-cntt', name: 'Công nghệ thông tin' },
      }),
    },
    group: {
      findMany: async () => [
        {
          id: 'grp-01',
          code: 'N01',
          name: 'Nhóm AI Bệnh Cây Trồng',
          topic: {
            id: '11111111-1111-1111-1111-111111111111',
            title: 'Xây dựng hệ thống thị giác máy tính nhận diện bệnh trên cây trồng bằng YOLO và PyTorch',
            technologies: 'Python, PyTorch, YOLOv8, OpenCV, FastAPI',
            summary: 'Học sâu phát hiện bệnh cây trồng',
            ownerId: 'advisor-user-id',
            owner: { fullName: 'TS. Nguyễn Hướng Dẫn' },
          },
        },
      ],
    },
  };

  const aiService = new DefenseAiService(mockPrisma);

  // 1. Test Reviewer Recommendation
  console.log('1. Kiểm tra recommendReviewers:');
  const reviewerRec = await aiService.recommendReviewers({
    topicId: '11111111-1111-1111-1111-111111111111',
  });

  console.log(`- GVHD đề tài: ${reviewerRec.topic.advisorName}`);
  console.log(`- GVHD đã bị loại trừ khỏi phản biện: ${reviewerRec.topic.advisorExcluded}`);

  // Đảm bảo GVHD không nằm trong danh sách GVPB khả dụng
  const advisorAsReviewer = reviewerRec.topReviewers.find(
    (r: any) => r.isAdvisor || r.userId === 'advisor-user-id'
  );
  if (advisorAsReviewer && advisorAsReviewer.isAvailable) {
    throw new Error('FAIL: GVHD bị phân làm phản biện khả dụng!');
  }
  console.log('✓ PASS: Chống xung đột GVHD - GVHD không thể làm phản biện cho đề tài của mình.');

  console.log(`- Số lượng GVPB đề xuất: ${reviewerRec.topReviewers.length}`);
  console.log(`- Top 1 GVPB: ${reviewerRec.topReviewers[0].fullName} (${reviewerRec.topReviewers[0].score}% phù hợp)`);
  console.log(`  Lý do AI: ${reviewerRec.topReviewers[0].matchReason}`);
  console.log(`  Từ khóa khớp: ${reviewerRec.topReviewers[0].matchedKeywords.join(', ')}`);

  if (!reviewerRec.suggestedPair) {
    throw new Error('FAIL: Không sinh được cặp GVPB tối ưu!');
  }
  console.log(`- Cặp GVPB tối ưu: ${reviewerRec.suggestedPair.name}`);
  console.log(`  Lý do ghép cặp: ${reviewerRec.suggestedPair.synergyReason}`);
  console.log('✓ PASS: Đề xuất GVPB và cặp GVPB thành công.');

  // 2. Test Committee Recommendation
  console.log('\n2. Kiểm tra recommendCommittee:');
  const committeeRec = await aiService.recommendCommittee({
    semesterId: 'sem-2026',
    groupIds: ['grp-01'],
    committeeSize: 3,
  });

  const comm = committeeRec.suggestedCommittee;
  console.log(`- Tên hội đồng: ${comm.name}`);
  console.log(`- Chủ tịch: ${comm.president.title} ${comm.president.fullName} - Lý do: ${comm.president.reason}`);
  console.log(`- Thư ký: ${comm.secretary.title} ${comm.secretary.fullName} - Lý do: ${comm.secretary.reason}`);
  console.log(`- UV Phản biện: ${comm.reviewerMember.title} ${comm.reviewerMember.fullName} - Lý do: ${comm.reviewerMember.reason}`);
  console.log(`- Đánh giá tổng quan: ${comm.overallReason}`);

  // Kiểm tra chống xung đột trong hội đồng
  const members = [comm.president.userId, comm.secretary.userId, comm.reviewerMember.userId];
  if (members.includes('advisor-user-id')) {
    throw new Error('FAIL: GVHD nhóm được xếp vào Hội đồng chấm!');
  }
  console.log('✓ PASS: Chống xung đột Hội đồng - GVHD của nhóm bảo vệ bị loại trừ tuyệt đối.');

  console.log(`- Số GVHD bị loại trừ do xung đột: ${committeeRec.conflictExcludedLecturers.length}`);
  console.log(`  Thông tin GVHD loại trừ: ${committeeRec.conflictExcludedLecturers[0]?.fullName} - ${committeeRec.conflictExcludedLecturers[0]?.reason}`);

  console.log('\n========================================');
  console.log('🎉 TẤT CẢ UNIT TESTS ĐÃ VƯỢT QUA 100%! 🎉');
  console.log('========================================');
}

runUnitTest().catch((err) => {
  console.error('Lỗi unit test:', err);
  process.exit(1);
});
