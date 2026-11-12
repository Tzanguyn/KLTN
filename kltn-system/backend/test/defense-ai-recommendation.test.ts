import { PrismaClient } from '@prisma/client';
import { DefenseAiService } from '../src/modules/defense/defense-ai.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function runTest() {
  console.log('--- BẮT ĐẦU KIỂM THỬ DEFENSE AI SERVICE ---');
  const prisma = new PrismaService();
  const aiService = new DefenseAiService(prisma);

  try {
    // 1. Kiểm tra trạng thái AI
    const status = await aiService.getAiStatus();
    console.log('1. Trạng thái AI Engine:', status);

    // 2. Lấy một đề tài có sẵn trong DB để thử nghiệm đề xuất GVPB
    const sampleTopic = await prisma.topic.findFirst({
      where: { status: 'APPROVED' },
      include: { owner: true },
    });

    if (sampleTopic) {
      console.log(`2. Đang kiểm thử đề xuất GVPB cho đề tài: "${sampleTopic.title}" (GVHD: ${sampleTopic.owner.fullName})...`);
      const reviewerRec = await aiService.recommendReviewers({
        topicId: sampleTopic.id,
        topN: 4,
      });

      console.log(`- Engine đã sử dụng: ${reviewerRec.engineUsed}`);
      console.log(`- GVHD đã loại trừ: ${reviewerRec.topic.advisorName} (Loại trừ: ${reviewerRec.topic.advisorExcluded})`);
      console.log(`- Số lượng GVPB đề xuất: ${reviewerRec.topReviewers.length}`);
      if (reviewerRec.topReviewers.length > 0) {
        const top1 = reviewerRec.topReviewers[0];
        console.log(`  + Top 1: ${top1.title} ${top1.fullName} - Điểm: ${top1.score}%`);
        console.log(`    Lý do: ${top1.matchReason}`);
        console.log(`    Từ khóa khớp: ${top1.matchedKeywords.join(', ')}`);
      }

      if (reviewerRec.suggestedPair) {
        console.log(`- Cặp GVPB tối ưu: ${reviewerRec.suggestedPair.name} (Điểm: ${reviewerRec.suggestedPair.pairScore}%)`);
        console.log(`  Lý do ghép cặp: ${reviewerRec.suggestedPair.synergyReason}`);
      }
    } else {
      console.log('2. Không tìm thấy đề tài APPROVED, thử đề xuất trực tiếp từ từ khóa...');
      const customRec = await aiService.recommendReviewers({
        title: 'Nghiên cứu thị giác máy tính nhận diện biển báo giao thông sử dụng YOLO và PyTorch',
        technologies: 'Python, PyTorch, YOLOv8, OpenCV, FastAPI',
        summary: 'Xây dựng mô hình học sâu phát hiện biển báo giao thông thời gian thực',
        topN: 3,
      });
      console.log(`- Đề xuất cho đề tài tùy biến: ${customRec.topReviewers.length} giảng viên`);
    }

    // 3. Kiểm tra đề xuất Hội đồng bảo vệ
    const semester = await prisma.semester.findFirst({
      where: { status: 'OPEN' },
    });

    const groups = await prisma.group.findMany({
      where: semester ? { semesterId: semester.id } : undefined,
      take: 2,
    });

    if (semester && groups.length > 0) {
      console.log(`3. Đang kiểm thử đề xuất Hội đồng cho ${groups.length} nhóm...`);
      const committeeRec = await aiService.recommendCommittee({
        semesterId: semester.id,
        groupIds: groups.map((g) => g.id),
        committeeSize: 4,
      });

      console.log(`- Tên hội đồng gợi ý: ${committeeRec.suggestedCommittee.name}`);
      console.log(`- Chủ tịch: ${committeeRec.suggestedCommittee.president.title} ${committeeRec.suggestedCommittee.president.fullName} (${committeeRec.suggestedCommittee.president.score} điểm)`);
      console.log(`  Lý do: ${committeeRec.suggestedCommittee.president.reason}`);
      console.log(`- Thư ký: ${committeeRec.suggestedCommittee.secretary.title} ${committeeRec.suggestedCommittee.secretary.fullName}`);
      console.log(`- UV Phản biện: ${committeeRec.suggestedCommittee.reviewerMember.title} ${committeeRec.suggestedCommittee.reviewerMember.fullName} (${committeeRec.suggestedCommittee.reviewerMember.score} điểm)`);
      console.log(`- Số giảng viên xung đột GVHD bị loại trừ: ${committeeRec.conflictExcludedLecturers.length}`);
      console.log(`- Đánh giá tổng quan: ${committeeRec.suggestedCommittee.overallReason}`);
    }

    console.log('--- KIỂM THỬ THÀNH CÔNG TỐT ĐẸP ---');
  } catch (error) {
    console.error('Lỗi kiểm thử:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
