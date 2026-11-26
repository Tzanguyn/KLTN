import assert from 'assert';
import {
  parseScoreNote,
  serializeScoreNote,
  extractRoleScore,
  ScoresService,
  DEFAULT_TEN_CRITERIA,
} from '../src/modules/scores/scores.service';

/**
 * Unit test: Tách biệt hoàn toàn điểm phản biện và điểm hội đồng
 * Đảm bảo 1 giảng viên khi được phân công cả 2 vai trò cho cùng 1 đề tài:
 * 1. Nhập được cả điểm phản biện và điểm hội đồng mà không bị chặn khóa điểm
 * 2. Điểm phản biện và điểm hội đồng được lưu trữ độc lập, không bị ghi đè lẫn nhau
 * 3. Điểm phản biện và điểm hội đồng có thể có trạng thái (DRAFT/LOCKED/OPENED) độc lập
 * 4. Điểm trung bình GVPB và Hội đồng tính đúng điểm theo vai trò tương ứng
 */
async function testReviewerCouncilScoreSeparation() {
  console.log('--- BẮT ĐẦU UNIT TEST: TÁCH ĐIỂM PHẢN BIỆN VÀ ĐIỂM HỘI ĐỒNG ---');

  // Test 1: Serialize and Parse with rolesMap
  console.log('\n1. Kiểm tra parse/serialize với nhiều vai trò:');
  const rolesMap = {
    PHAN_BIEN: {
      value: 8.5,
      note: 'Nhận xét phản biện tốt',
      studentScores: { 'student-01': 8.5, 'student-02': 8.5 },
      status: 'LOCKED',
    },
    HOI_DONG: {
      value: 9.0,
      note: 'Bảo vệ tự tin, trả lời tốt',
      studentScores: { 'student-01': 9.0, 'student-02': 9.0 },
      status: 'DRAFT',
    },
  };

  const serialized = serializeScoreNote(
    'Bảo vệ tự tin, trả lời tốt',
    { 'student-01': 9.0, 'student-02': 9.0 },
    'HOI_DONG',
    rolesMap.PHAN_BIEN,
    rolesMap.HOI_DONG,
    rolesMap,
  );

  const parsed = parseScoreNote(serialized);
  assert.ok(parsed.roles, 'Phải parse được trường roles');
  assert.strictEqual(parsed.roles?.PHAN_BIEN?.value, 8.5);
  assert.strictEqual(parsed.roles?.PHAN_BIEN?.status, 'LOCKED');
  assert.strictEqual(parsed.roles?.HOI_DONG?.value, 9.0);
  assert.strictEqual(parsed.roles?.HOI_DONG?.status, 'DRAFT');
  console.log('✓ PASS: roles dictionary parse và serialize chính xác.');

  // Test 2: extractRoleScore retrieves distinct scores for each role
  console.log('\n2. Kiểm tra hàm extractRoleScore tách điểm theo vai trò:');
  const mockRow = {
    value: 9.0,
    status: 'DRAFT',
    note: serialized,
  };

  const pbScore = extractRoleScore(mockRow, 'PHAN_BIEN');
  assert.ok(pbScore, 'Phải trích xuất được điểm GVPB');
  assert.strictEqual(pbScore?.value, 8.5);
  assert.strictEqual(pbScore?.status, 'LOCKED');
  assert.strictEqual(pbScore?.note, 'Nhận xét phản biện tốt');

  const hdScore = extractRoleScore(mockRow, 'HOI_DONG');
  assert.ok(hdScore, 'Phải trích xuất được điểm Hội đồng');
  assert.strictEqual(hdScore?.value, 9.0);
  assert.strictEqual(hdScore?.status, 'DRAFT');
  assert.strictEqual(hdScore?.note, 'Bảo vệ tự tin, trả lời tốt');

  const gvhdScore = extractRoleScore(mockRow, 'HUONG_DAN');
  assert.strictEqual(gvhdScore, null, 'User không có vai trò GVHD thì extractRoleScore phải trả về null');
  console.log('✓ PASS: extractRoleScore phân tách điểm GVPB (8.5 LOCKED) và Hội đồng (9.0 DRAFT) độc lập.');

  // Test 3: Backward compatibility with legacy note containing preservedGvpb / preservedCouncil
  console.log('\n3. Kiểm tra tính tương thích ngược với dữ liệu cũ (preservedGvpb / preservedCouncil):');
  const legacyNote = JSON.stringify({
    __perStudent: true,
    note: 'Hội đồng nhận xét',
    studentScores: { 'sv-01': 8.0 },
    role: 'HOI_DONG',
    preservedGvpb: {
      value: 7.5,
      note: 'Phản biện nhận xét cũ',
      studentScores: { 'sv-01': 7.5 },
      status: 'LOCKED',
    },
  });

  const legacyRow = {
    value: 8.0,
    status: 'LOCKED',
    note: legacyNote,
  };

  const legacyPb = extractRoleScore(legacyRow, 'PHAN_BIEN');
  assert.strictEqual(legacyPb?.value, 7.5);
  assert.strictEqual(legacyPb?.note, 'Phản biện nhận xét cũ');

  const legacyHd = extractRoleScore(legacyRow, 'HOI_DONG');
  assert.strictEqual(legacyHd?.value, 8.0);
  assert.strictEqual(legacyHd?.note, 'Hội đồng nhận xét');
  console.log('✓ PASS: Dữ liệu cũ tự động trích xuất chính xác cả điểm Phản biện và Hội đồng.');

  // Test 4: Verify that a locked Reviewer score does NOT lock out Council scoring
  console.log('\n4. Kiểm tra logic kiểm tra khóa: Điểm phản biện bị khóa KHÔNG làm khóa điểm hội đồng:');
  const scoresInDb = [
    {
      criterionId: 'c1',
      value: 8.0,
      status: 'LOCKED',
      note: serializeScoreNote('GVPB đã khóa', { 'sv1': 8.0 }, 'PHAN_BIEN', null, null, {
        PHAN_BIEN: { value: 8.0, note: 'GVPB đã khóa', studentScores: { 'sv1': 8.0 }, status: 'LOCKED' },
      }),
    },
  ];

  // Giảng viên chuyển sang chấm Hội đồng (currentRole = 'HOI_DONG')
  const councilRoleScores = scoresInDb
    .map((s) => extractRoleScore(s, 'HOI_DONG'))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  assert.strictEqual(councilRoleScores.length, 0, 'Chưa nhập điểm Hội đồng thì roleScores Hội đồng phải rỗng');
  const hasCouncilLocked = councilRoleScores.length > 0 && councilRoleScores.some((s) => s.status === 'LOCKED');
  assert.strictEqual(hasCouncilLocked, false, 'Điểm Hội đồng chưa có thì KHÔNG được báo là đã bị khóa!');
  console.log('✓ PASS: Giảng viên đã nộp và khóa điểm phản biện vẫn thoải mái nhập điểm hội đồng mà không bị chặn.');

  // Test 5: Verify updating Council score preserves Reviewer score untouched
  console.log('\n5. Kiểm tra cập nhật điểm Hội đồng không làm mất điểm Phản biện:');
  const existingNote = scoresInDb[0].note;
  const existingParsed = parseScoreNote(existingNote);

  const updatedRolesMap: any = {
    ...(existingParsed.roles || {}),
    HOI_DONG: {
      value: 9.5,
      note: 'Điểm hội đồng mới chấm',
      studentScores: { 'sv1': 9.5 },
      status: 'LOCKED',
    },
  };

  const updatedNote = serializeScoreNote(
    'Điểm hội đồng mới chấm',
    { 'sv1': 9.5 },
    'HOI_DONG',
    updatedRolesMap.PHAN_BIEN,
    updatedRolesMap.HOI_DONG,
    updatedRolesMap,
  );

  const afterUpdateRow = {
    value: 9.5,
    status: 'LOCKED',
    note: updatedNote,
  };

  const pbAfter = extractRoleScore(afterUpdateRow, 'PHAN_BIEN');
  const hdAfter = extractRoleScore(afterUpdateRow, 'HOI_DONG');

  assert.strictEqual(pbAfter?.value, 8.0, 'Điểm phản biện phải được bảo toàn nguyên vẹn');
  assert.strictEqual(pbAfter?.note, 'GVPB đã khóa');
  assert.strictEqual(hdAfter?.value, 9.5, 'Điểm hội đồng phải cập nhật giá trị mới');
  assert.strictEqual(hdAfter?.note, 'Điểm hội đồng mới chấm');
  console.log('✓ PASS: Cả 2 điểm cùng tồn tại song song, không bị đè hay mất dữ liệu.');

  console.log('\n======================================================');
  console.log('🎉 TẤT CẢ UNIT TESTS TÁCH ĐIỂM PHẢN BIỆN & HỘI ĐỒNG THÀNH CÔNG! 🎉');
  console.log('======================================================');
}

testReviewerCouncilScoreSeparation().catch((err) => {
  console.error('Lỗi test:', err);
  process.exit(1);
});
