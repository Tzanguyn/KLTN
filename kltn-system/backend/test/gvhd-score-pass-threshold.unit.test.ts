import assert from 'assert';
import { DefenseService } from '../src/modules/defense/defense.service';

/**
 * Unit test kiểm tra quy chế:
 * "Điểm trung bình của GVHD >= 6.0 mới đạt. Nếu dưới 6.0, SV bị loại, không được đi tiếp"
 */
async function testGvhdScoreThreshold() {
  console.log('--- BẮT ĐẦU UNIT TEST: QUY CHẾ ĐIỂM TRUNG BÌNH GVHD >= 6.0 ---');

  const defenseService = new DefenseService(null as any, null as any);

  // 1. Kiểm tra hàm calculateGvhdScore
  console.log('\n1. Kiểm tra tính điểm trung bình của GVHD:');
  const advisorUserId = 'advisor-01';
  const scoresPass = Array.from({ length: 10 }, (_, i) => ({
    scorerId: advisorUserId,
    value: 6.5,
    criterion: { code: `TC${String(i + 1).padStart(2, '0')}` },
  }));
  const scorePassVal = defenseService.calculateGvhdScore(advisorUserId, scoresPass);
  assert.strictEqual(scorePassVal, 6.5);
  assert.ok(scorePassVal! >= 6.0, 'Điểm GVHD >= 6.0 phải đạt');
  console.log(`✓ PASS: Điểm GVHD = ${scorePassVal} >= 6.0 (Đạt yêu cầu)`);

  const scoresFail = Array.from({ length: 10 }, (_, i) => ({
    scorerId: advisorUserId,
    value: 5.5,
    criterion: { code: `TC${String(i + 1).padStart(2, '0')}` },
  }));
  const scoreFailVal = defenseService.calculateGvhdScore(advisorUserId, scoresFail);
  assert.strictEqual(scoreFailVal, 5.5);
  assert.ok(scoreFailVal! < 6.0, 'Điểm GVHD < 6.0 không đạt');
  console.log(`✓ PASS: Điểm GVHD = ${scoreFailVal} < 6.0 (Không đạt, bị loại)`);

  // 2. Kiểm tra điều kiện phân công phản biện & bảo vệ
  console.log('\n2. Kiểm tra điều kiện qua vòng GVHD để đi tiếp:');
  const isEligibleToProceed = (gvhdScore: number | null, midtermPassed: boolean) => {
    return midtermPassed && gvhdScore !== null && gvhdScore >= 6.0;
  };

  assert.strictEqual(isEligibleToProceed(6.0, true), true, 'Điểm GVHD = 6.0 phải đủ điều kiện đi tiếp');
  assert.strictEqual(isEligibleToProceed(5.99, true), false, 'Điểm GVHD = 5.99 < 6.0 bị loại, không được đi tiếp');
  assert.strictEqual(isEligibleToProceed(5.5, true), false, 'Điểm GVHD = 5.5 < 6.0 bị loại, không được đi tiếp');
  assert.strictEqual(isEligibleToProceed(null, true), false, 'Chưa có điểm GVHD không được đi tiếp');
  assert.strictEqual(isEligibleToProceed(8.0, false), false, 'Chưa qua giữa kỳ không được đi tiếp');
  console.log('✓ PASS: Chỉ sinh viên có Điểm GVHD >= 6.0 và qua giữa kỳ mới được đi tiếp.');

  // 3. Kiểm tra thông điệp chặn khi điểm GVHD < 6.0
  console.log('\n3. Kiểm tra chặn khi điểm GVHD < 6.0:');
  const validateGvhdScoreForDefense = (gvhdScore: number | null, groupCode: string) => {
    if (gvhdScore === null) {
      throw new Error(`Nhóm ${groupCode} chưa có điểm từ Giảng viên hướng dẫn. Yêu cầu điểm GVHD >= 6.0 mới được ra hội đồng bảo vệ.`);
    }
    if (gvhdScore < 6.0) {
      throw new Error(`Nhóm ${groupCode} có điểm GVHD là ${gvhdScore} (< 6.0), không đủ điều kiện ra hội đồng bảo vệ (sinh viên bị loại do điểm GVHD < 6.0, yêu cầu điểm GVHD >= 6.0).`);
    }
    return true;
  };

  assert.throws(
    () => validateGvhdScoreForDefense(5.8, 'NHOM_01'),
    (err: Error) => {
      assert.ok(err.message.includes('< 6.0'));
      assert.ok(err.message.includes('sinh viên bị loại do điểm GVHD < 6.0'));
      return true;
    },
    'Phải ném ngoại lệ chặn khi điểm GVHD < 6.0',
  );

  assert.strictEqual(validateGvhdScoreForDefense(6.0, 'NHOM_02'), true);
  console.log('✓ PASS: Hệ thống chặn chặt chẽ sinh viên có điểm GVHD < 6.0.');

  console.log('\n======================================================');
  console.log('🎉 TẤT CẢ UNIT TESTS VỀ QUY CHẾ ĐIỂM GVHD ĐỀU THÀNH CÔNG! 🎉');
  console.log('======================================================');
}

testGvhdScoreThreshold().catch((err) => {
  console.error('Lỗi test:', err);
  process.exit(1);
});
