import assert from 'node:assert';
import { DefenseService } from '../src/modules/defense/defense.service';

async function runThirdReviewerUnitTest() {
  console.log('--- BẮT ĐẦU UNIT TEST: QUY CHẾ PHÂN CÔNG GVPB THỨ 3 & TÍNH ĐIỂM TRUNG BÌNH 3 GVPB ---');

  const defenseService = new DefenseService(null as any, null as any);

  // 1. Kiểm tra tính điểm: Không lệch điểm (2 GVPB chênh nhau < 4 và chênh GVHD < 2)
  console.log('\n1. Kiểm tra 2 GVPB không lệch điểm...');
  {
    const assignments = [
      { lecturerId: 'lec-1', userId: 'user-1', lecturer: { user: { id: 'user-1', fullName: 'TS. Nguyễn Văn A' } }, type: 'PRIMARY' },
      { lecturerId: 'lec-2', userId: 'user-2', lecturer: { user: { id: 'user-2', fullName: 'ThS. Trần Thị B' } }, type: 'ADDITIONAL' },
    ];
    const scores = [
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-1', value: 8.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-2', value: 8.5, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
    ];
    const gvhdScore = 8.0;

    const res = defenseService.calculateReviewerScore(assignments, scores, gvhdScore);
    assert.strictEqual(res.hasDiscrepancy, false, 'Không được phát hiện lệch điểm');
    assert.strictEqual(res.needsThirdReviewer, false, 'Không cần GVPB thứ 3');
    assert.strictEqual(res.hasThirdReviewer, false, 'Chưa có GVPB thứ 3');
    assert.strictEqual(res.score, 8.25, 'Điểm TB = (8.0 + 8.5) / 2 = 8.25');
    console.log(' -> Thành công: Điểm GVPB bình thường = 8.25 (TB cộng 2 GVPB)');
  }

  // 2. Kiểm tra lệch điểm giữa 2 GVPB >= 4 điểm
  console.log('\n2. Kiểm tra lệch điểm giữa 2 GVPB >= 4.0 điểm...');
  {
    const assignments = [
      { lecturerId: 'lec-1', userId: 'user-1', lecturer: { user: { id: 'user-1', fullName: 'TS. Nguyễn Văn A' } }, type: 'PRIMARY' },
      { lecturerId: 'lec-2', userId: 'user-2', lecturer: { user: { id: 'user-2', fullName: 'ThS. Trần Thị B' } }, type: 'ADDITIONAL' },
    ];
    const scores = [
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-1', value: 8.5, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-2', value: 4.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
    ];
    const gvhdScore = 7.0; // GVHD = 7.0, chênh với 8.5 là 1.5 (<2), nhưng GVPB 1 và 2 chênh nhau 4.5 >= 4.0

    const res = defenseService.calculateReviewerScore(assignments, scores, gvhdScore);
    assert.strictEqual(res.hasDiscrepancy, true, 'Phải phát hiện lệch điểm');
    assert.strictEqual(res.isReviewersDiscrepancy, true, 'Phải phát hiện chênh lệch 2 GVPB >= 4đ');
    assert.strictEqual(res.needsThirdReviewer, true, 'Cần phân công GVPB thứ 3');
    assert.strictEqual(res.hasThirdReviewer, false, 'Chưa có GVPB thứ 3');
    assert.strictEqual(res.score, null, 'Chưa thể chốt điểm GVPB khi đang chờ GVPB 3');
    assert(res.discrepancyReasons.some((r) => r.includes('4.5')), 'Phải có lý do chênh lệch 4.5đ');
    console.log(' -> Thành công: Phát hiện chênh lệch 2 GVPB (4.5đ >= 4.0đ), kích hoạt cờ needsThirdReviewer!');
  }

  // 3. Kiểm tra lệch điểm giữa GVPB và GVHD >= 2 điểm
  console.log('\n3. Kiểm tra lệch điểm giữa GVPB và GVHD >= 2.0 điểm...');
  {
    const assignments = [
      { lecturerId: 'lec-1', userId: 'user-1', lecturer: { user: { id: 'user-1', fullName: 'TS. Nguyễn Văn A' } }, type: 'PRIMARY' },
      { lecturerId: 'lec-2', userId: 'user-2', lecturer: { user: { id: 'user-2', fullName: 'ThS. Trần Thị B' } }, type: 'ADDITIONAL' },
    ];
    // GVPB 1 = 9.0, GVPB 2 = 8.0 (chênh nhau 1.0 < 4.0). Nhưng GVHD = 6.5 -> chênh với GVPB 1 là 2.5 >= 2.0
    const scores = [
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-1', value: 9.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-2', value: 8.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
    ];
    const gvhdScore = 6.5;

    const res = defenseService.calculateReviewerScore(assignments, scores, gvhdScore);
    assert.strictEqual(res.hasDiscrepancy, true, 'Phải phát hiện lệch điểm với GVHD');
    assert.strictEqual(res.isGvhdDiscrepancy, true, 'Phải phát hiện chênh lệch với GVHD >= 2đ');
    assert.strictEqual(res.needsThirdReviewer, true, 'Cần phân công GVPB thứ 3');
    assert.strictEqual(res.score, null, 'Chưa thể chốt điểm GVPB');
    assert(res.discrepancyReasons.some((r) => r.includes('2.5')), 'Phải có lý do chênh lệch 2.5đ với GVHD');
    console.log(' -> Thành công: Phát hiện chênh lệch GVPB và GVHD (2.5đ >= 2.0đ), kích hoạt cờ needsThirdReviewer!');
  }

  // 4. Kiểm tra khi ĐÃ PHÂN CÔNG GVPB THỨ 3: Điểm GVPB là trung bình cộng của 3 GVPB
  console.log('\n4. Kiểm tra khi đã có 3 GVPB: Điểm GVPB là trung bình của 3 GVPB...');
  {
    const assignments = [
      { lecturerId: 'lec-1', userId: 'user-1', lecturer: { user: { id: 'user-1', fullName: 'TS. Nguyễn Văn A' } }, type: 'PRIMARY' },
      { lecturerId: 'lec-2', userId: 'user-2', lecturer: { user: { id: 'user-2', fullName: 'ThS. Trần Thị B' } }, type: 'ADDITIONAL' },
      { lecturerId: 'lec-3', userId: 'user-3', lecturer: { user: { id: 'user-3', fullName: 'TS. Lê Văn C' } }, type: 'ADDITIONAL' },
    ];
    // GVPB 1 = 9.0, GVPB 2 = 5.0, GVPB 3 = 7.0
    // Trung bình = (9.0 + 5.0 + 7.0) / 3 = 21.0 / 3 = 7.00
    const scores = [
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-1', value: 9.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-2', value: 5.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-3', value: 7.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
    ];
    const gvhdScore = 7.0;

    const res = defenseService.calculateReviewerScore(assignments, scores, gvhdScore);
    assert.strictEqual(res.hasThirdReviewer, true, 'Đã có 3 GVPB');
    assert.strictEqual(res.needsThirdReviewer, false, 'Không còn thiếu GVPB 3 nữa');
    assert.strictEqual(res.score, 7.0, 'Điểm TB cộng 3 GVPB phải chính xác là 7.0');
    assert(res.formula.includes('(9 + 5 + 7) / 3') || res.formula.includes('Trung bình cộng 3 GVPB'), 'Công thức phải thể hiện trung bình 3 GVPB');
    console.log(` -> Thành công: Điểm GVPB khi có 3 GVPB = ${res.score} [${res.formula}]`);
  }

  // 5. Kiểm tra khi có 3 GVPB nhưng GVPB 3 chưa nộp điểm
  console.log('\n5. Kiểm tra khi có 3 GVPB nhưng GVPB 3 chưa nộp điểm...');
  {
    const assignments = [
      { lecturerId: 'lec-1', userId: 'user-1', lecturer: { user: { id: 'user-1', fullName: 'TS. Nguyễn Văn A' } }, type: 'PRIMARY' },
      { lecturerId: 'lec-2', userId: 'user-2', lecturer: { user: { id: 'user-2', fullName: 'ThS. Trần Thị B' } }, type: 'ADDITIONAL' },
      { lecturerId: 'lec-3', userId: 'user-3', lecturer: { user: { id: 'user-3', fullName: 'TS. Lê Văn C' } }, type: 'ADDITIONAL' },
    ];
    // GVPB 1 & 2 đã có điểm, GVPB 3 chưa chấm
    const scores = [
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-1', value: 9.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
      ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'user-2', value: 5.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
    ];
    const gvhdScore = 7.0;

    const res = defenseService.calculateReviewerScore(assignments, scores, gvhdScore);
    assert.strictEqual(res.hasThirdReviewer, true, 'Đã có 3 GVPB');
    assert.strictEqual(res.score, null, 'Chưa có điểm GVPB do đang chờ GVPB 3 chấm');
    assert(res.formula.includes('chờ GVPB thứ 3') || res.formula.includes('Chờ GVPB thứ 3'), 'Công thức thể hiện trạng thái chờ GVPB 3');
    console.log(' -> Thành công: Điểm GVPB là null và ghi rõ đang chờ GVPB 3 chấm điểm');
  }

  // 6. Kiểm tra các ràng buộc khi phân công GVPB 3 (Anti-conflict & Discrepancy checks)
  console.log('\n6. Kiểm tra quy trình phân công GVPB thứ 3 (Mock Prisma Service)...');
  {
    const mockGroup = {
      id: 'grp-test-1',
      code: 'NHOM_01',
      name: 'Nhóm AI Lệch Điểm',
      semesterId: 'sem-2026',
      midtermStatus: 'CONTINUE',
      topic: {
        id: 'top-1',
        title: 'Xây dựng mô hình AI nhận diện biển báo',
        ownerId: 'advisor-user-id',
        owner: { id: 'advisor-user-id', fullName: 'TS. Hướng Dẫn', lecturerProfile: { id: 'advisor-lec-id' } },
      },
      members: [],
      scores: [
        ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'advisor-user-id', value: 7.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
        ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'rev1-user-id', value: 9.0, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
        ...Array.from({ length: 10 }, (_, i) => ({ scorerId: 'rev2-user-id', value: 4.5, criterion: { code: `TC0${i + 1}` }, status: 'SUBMITTED' })),
      ],
      reviewerAssignments: [
        { id: 'ra-1', lecturerId: 'rev1-lec-id', type: 'PRIMARY', assignedAt: new Date(1), lecturer: { user: { id: 'rev1-user-id', fullName: 'TS. Phản Biện 1' } } },
        { id: 'ra-2', lecturerId: 'rev2-lec-id', type: 'ADDITIONAL', assignedAt: new Date(2), lecturer: { user: { id: 'rev2-user-id', fullName: 'ThS. Phản Biện 2' } } },
      ],
    };

    const mockLecturers: Record<string, any> = {
      'advisor-lec-id': { id: 'advisor-lec-id', userId: 'advisor-user-id', user: { fullName: 'TS. Hướng Dẫn', status: 'ACTIVE' }, quotas: [] },
      'rev1-lec-id': { id: 'rev1-lec-id', userId: 'rev1-user-id', user: { fullName: 'TS. Phản Biện 1', status: 'ACTIVE' }, quotas: [] },
      'rev2-lec-id': { id: 'rev2-lec-id', userId: 'rev2-user-id', user: { fullName: 'ThS. Phản Biện 2', status: 'ACTIVE' }, quotas: [] },
      'rev3-valid-id': { id: 'rev3-valid-id', userId: 'rev3-valid-user', user: { fullName: 'TS. Phản Biện 3', status: 'ACTIVE', email: 'rev3@kltn.edu.vn' }, quotas: [{ maxGroups: 5 }] },
      'rev-overloaded-id': { id: 'rev-overloaded-id', userId: 'rev-overloaded-user', user: { fullName: 'TS. Quá Tải', status: 'ACTIVE' }, quotas: [{ maxGroups: 2 }] },
    };

    const mockPrisma: any = {
      group: {
        findUnique: async () => mockGroup,
      },
      lecturerProfile: {
        findFirst: async ({ where }: any) => {
          const id = where.OR[0]?.id || where.OR[1]?.userId;
          return mockLecturers[id] || null;
        },
      },
      systemConfig: {
        findFirst: async () => ({ value: 5 }),
      },
      reviewerAssignment: {
        count: async ({ where }: any) => (where.lecturerId === 'rev-overloaded-id' ? 3 : 1),
        upsert: async (args: any) => ({
          id: 'ra-3',
          groupId: args.create.groupId,
          lecturerId: args.create.lecturerId,
          type: args.create.type,
          lecturer: mockLecturers[args.create.lecturerId],
        }),
        delete: async () => ({ count: 1 }),
      },
      $transaction: async (cb: any) => cb(mockPrisma),
    };

    const mockNotifications: any = {
      create: async () => ({}),
    };

    const service = new DefenseService(mockPrisma, mockNotifications);

    // 6a. Chặn phân công trùng GVHD làm GVPB 3
    try {
      await service.assignThirdReviewer('hod-user', { groupId: 'grp-test-1', reviewerId: 'advisor-lec-id' });
      assert.fail('Phải chặn trùng GVHD');
    } catch (err: any) {
      assert(err.message.includes('Trùng GVHD'), 'Lỗi phải nêu rõ trùng GVHD');
      console.log(' -> 6a. Chặn trùng GVHD thành công:', err.message);
    }

    // 6b. Chặn phân công trùng GVPB 1 hoặc GVPB 2
    try {
      await service.assignThirdReviewer('hod-user', { groupId: 'grp-test-1', reviewerId: 'rev1-lec-id' });
      assert.fail('Phải chặn trùng GVPB 1');
    } catch (err: any) {
      assert(err.message.includes('không được trùng với GVPB 1 hoặc GVPB 2'), 'Lỗi phải nêu rõ trùng GVPB');
      console.log(' -> 6b. Chặn trùng GVPB 1/2 thành công:', err.message);
    }

    // 6c. Chặn phân công giảng viên quá tải hạn mức
    try {
      await service.assignThirdReviewer('hod-user', { groupId: 'grp-test-1', reviewerId: 'rev-overloaded-id' });
      assert.fail('Phải chặn giảng viên quá tải');
    } catch (err: any) {
      assert(err.message.includes('đạt định mức phản biện tối đa'), 'Lỗi phải nêu rõ vượt định mức');
      console.log(' -> 6c. Chặn vượt định mức phản biện thành công:', err.message);
    }

    // 6d. Phân công GVPB thứ 3 hợp lệ thành công
    const assignRes = await service.assignThirdReviewer('hod-user', {
      groupId: 'grp-test-1',
      reviewerId: 'rev3-valid-id',
      note: 'Phân công GVPB 3 do điểm 2 GVPB chênh nhau 4.5 điểm',
    });
    assert.strictEqual(assignRes.thirdReviewer.lecturerId, 'rev3-valid-id');
    assert.strictEqual(assignRes.thirdReviewer.lecturerName, 'TS. Phản Biện 3');
    assert(assignRes.message.includes('trung bình cộng của 3 GVPB'), 'Thông báo phải nêu rõ điểm tính theo TB cộng 3 GVPB');
    console.log(' -> 6d. Phân công GVPB thứ 3 hợp lệ thành công:', assignRes.message);

    // 6e. Hủy phân công GVPB thứ 3
    mockGroup.reviewerAssignments.push({
      id: 'ra-3',
      lecturerId: 'rev3-valid-id',
      type: 'ADDITIONAL' as any,
      assignedAt: new Date(3),
      lecturer: mockLecturers['rev3-valid-id'],
    });
    const removeRes = await service.removeThirdReviewer('hod-user', 'grp-test-1');
    assert(removeRes.message.includes('thành công'), 'Hủy GVPB 3 thành công');
    console.log(' -> 6e. Hủy phân công GVPB thứ 3 thành công:', removeRes.message);
  }

  console.log('\n TẤT CẢ UNIT TESTS VỀ GVPB THỨ 3 ĐỀU THÀNH CÔNG XUẤT SẮC!');
}

runThirdReviewerUnitTest().catch((err) => {
  console.error('Test thất bại:', err);
  process.exit(1);
});
