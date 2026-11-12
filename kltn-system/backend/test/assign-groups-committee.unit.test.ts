import assert from 'node:assert';
import { DefenseService } from '../src/modules/defense/defense.service';

async function runUnitTest() {
  console.log('--- BẮT ĐẦU UNIT TEST DEFENSE SERVICE: PHÂN NHÓM CHO HỘI ĐỒNG ---');

  // Database mock state
  const mockSchedules: any[] = [];
  const mockCommittees: any[] = [
    {
      id: 'com-uuid-1',
      name: 'Hội đồng Bảo vệ KLTN số 01',
      departmentId: 'dept-cntt',
      members: [
        { userId: 'lec-chairman-user', role: 'Chủ tịch', user: { fullName: 'TS. Nguyễn Văn A', email: 'a@kltn.edu.vn' } },
        { userId: 'lec-secretary-user', role: 'Thư ký', user: { fullName: 'ThS. Trần Thị B', email: 'b@kltn.edu.vn' } },
        { userId: 'lec-member-user', role: 'Ủy viên', user: { fullName: 'TS. Lê Văn C', email: 'c@kltn.edu.vn' } },
      ],
    },
  ];

  const mockGroups: Record<string, any> = {
    'grp-conflict': {
      id: 'grp-conflict',
      code: 'NHOM_01',
      name: 'Nhóm AI Xung Đột',
      semesterId: 'sem-2026',
      midtermStatus: 'CONTINUE',
      topic: {
        id: 'top-1',
        title: 'Hệ thống nhận diện biển báo giao thông',
        ownerId: 'lec-chairman-user', // Chairman of committee -> CONFLICT!
        owner: { fullName: 'TS. Nguyễn Văn A', email: 'a@kltn.edu.vn' },
      },
      scores: [
        {
          scorerId: 'lec-chairman-user',
          value: 8.5,
          criterion: { code: 'TC01', type: 'GVHD' },
        },
      ],
    },
    'grp-stopped': {
      id: 'grp-stopped',
      code: 'NHOM_02',
      name: 'Nhóm Dừng Tiến Độ',
      semesterId: 'sem-2026',
      midtermStatus: 'STOPPED', // Not CONTINUE -> REJECT!
      topic: {
        id: 'top-2',
        title: 'Xây dựng website bán hàng',
        ownerId: 'lec-external-user',
        owner: { fullName: 'ThS. Hoàng Văn D', email: 'd@kltn.edu.vn' },
      },
      scores: [],
    },
    'grp-poster': {
      id: 'grp-poster',
      code: 'NHOM_03',
      name: 'Nhóm Poster 80%',
      semesterId: 'sem-2026',
      midtermStatus: 'CONTINUE',
      topic: {
        id: 'top-3',
        title: 'Ứng dụng quản lý thư viện',
        ownerId: 'lec-external-user',
        owner: { fullName: 'ThS. Hoàng Văn D', email: 'd@kltn.edu.vn' },
      },
      scores: [
        {
          scorerId: 'lec-external-user',
          value: 7.0,
          criterion: { code: 'TC01', type: 'GVHD' },
        },
      ],
    },
    'grp-valid': {
      id: 'grp-valid',
      code: 'NHOM_TOP20',
      name: 'Nhóm Xuất Sắc Hợp Lệ',
      semesterId: 'sem-2026',
      midtermStatus: 'CONTINUE',
      topic: {
        id: 'top-4',
        title: 'Nền tảng phân tán xử lý dữ liệu lớn',
        ownerId: 'lec-external-user', // NOT in committee -> NO CONFLICT!
        owner: { fullName: 'ThS. Hoàng Văn D', email: 'd@kltn.edu.vn' },
      },
      scores: [
        {
          scorerId: 'lec-external-user',
          value: 9.0,
          criterion: { code: 'TC01', type: 'GVHD' },
        },
        {
          scorerId: 'lec-reviewer-user',
          value: 9.5,
          criterion: { code: 'GVPB_01', type: 'GVPB' },
        },
      ],
    },
  };

  const mockPrisma: any = {
    defenseCommittee: {
      findUnique: async ({ where }: any) => {
        return mockCommittees.find((c) => c.id === where.id) || null;
      },
      findMany: async ({ where }: any) => {
        return mockCommittees.map((c) => ({
          ...c,
          schedules: mockSchedules.filter((s) => s.committeeId === c.id),
        }));
      },
      create: async ({ data }: any) => {
        const newCom = {
          id: 'com-new-' + Date.now(),
          name: data.name,
          departmentId: data.departmentId,
          members: (data.members?.create || []).map((m: any) => ({
            userId: m.userId,
            role: m.role,
            user: { fullName: 'User ' + m.userId, email: m.userId + '@kltn.edu.vn' },
          })),
        };
        mockCommittees.push(newCom);
        return newCom;
      },
      delete: async ({ where }: any) => {
        const idx = mockCommittees.findIndex((c) => c.id === where.id);
        if (idx >= 0) mockCommittees.splice(idx, 1);
        return { id: where.id };
      },
    },
    defenseCommitteeMember: {
      deleteMany: async () => ({ count: 1 }),
    },
    semester: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        code: 'HK2-2025-2026',
        departmentId: 'dept-cntt',
        defenseFrom: new Date(),
      }),
    },
    group: {
      findMany: async ({ where }: any) => {
        const ids = where.id.in;
        return ids.map((id: string) => mockGroups[id]).filter(Boolean);
      },
    },
    groupMember: {
      findMany: async () => [],
    },
    systemConfig: {
      findFirst: async () => null,
    },
    defenseSchedule: {
      findMany: async ({ where }: any) => {
        return mockSchedules.filter((s) => {
          if (where.committeeId && s.committeeId !== where.committeeId) return false;
          if (where.semesterId && s.semesterId !== where.semesterId) return false;
          return true;
        });
      },
      findFirst: async ({ where }: any) => {
        return mockSchedules.find((s) => s.groupId === where.groupId && s.semesterId === where.semesterId) || null;
      },
      update: async ({ where, data }: any) => {
        const sch = mockSchedules.find((s) => s.id === where.id);
        if (sch) Object.assign(sch, data);
        return sch;
      },
      updateMany: async ({ where, data }: any) => {
        mockSchedules.filter((s) => s.committeeId === where.committeeId).forEach((s) => Object.assign(s, data));
        return { count: 1 };
      },
      create: async ({ data }: any) => {
        const sch = { id: 'sch-' + Date.now() + Math.random(), ...data };
        mockSchedules.push(sch);
        return sch;
      },
    },
    $transaction: async (cb: any) => cb(mockPrisma),
  };

  const mockNotifications: any = {
    create: async () => ({ id: 'notif-1' }),
  };

  const service = new DefenseService(mockPrisma, mockNotifications);

  // Mock getGroupDefenseFormat for testing classification
  (service as any).getGroupDefenseFormat = async (groupId: string) => {
    if (groupId === 'grp-poster') {
      return { defenseFormat: 'POSTER', reviewerScore: 6.5 };
    }
    return { defenseFormat: 'HOI_DONG', reviewerScore: 9.5 };
  };

  // TEST 1: Chống xung đột GVHD khi phân nhóm cho hội đồng
  console.log('1. Kiểm tra chống xung đột vai trò GVHD...');
  try {
    await service.assignGroupsToCommittee('head-id', 'com-uuid-1', {
      semesterId: 'sem-2026',
      groupIds: ['grp-conflict'],
    });
    assert.fail('Phải chặn nhóm có GVHD là thành viên Hội đồng');
  } catch (err: any) {
    assert(
      err.message.includes('Xung đột vai trò') && err.message.includes('TS. Nguyễn Văn A'),
      `Lỗi phải nêu rõ xung đột vai trò: ${err.message}`,
    );
    console.log(' -> Đã chặn thành công nhóm có GVHD là Chủ tịch Hội đồng:', err.message);
  }

  // TEST 2: Chặn nhóm chưa đạt điều kiện CHO_LAM_TIEP
  console.log('2. Kiểm tra chặn nhóm chưa đạt giữa kỳ...');
  try {
    await service.assignGroupsToCommittee('head-id', 'com-uuid-1', {
      semesterId: 'sem-2026',
      groupIds: ['grp-stopped'],
    });
    assert.fail('Phải chặn nhóm chưa CHO_LAM_TIEP');
  } catch (err: any) {
    assert(
      err.message.includes('CHO_LAM_TIEP'),
      `Lỗi phải nêu rõ chưa CHO_LAM_TIEP: ${err.message}`,
    );
    console.log(' -> Đã chặn thành công nhóm chưa CHO_LAM_TIEP:', err.message);
  }

  // TEST 3: Chặn nhóm thuộc diện Báo cáo Poster (80%)
  console.log('3. Kiểm tra chặn nhóm thuộc diện Poster...');
  try {
    await service.assignGroupsToCommittee('head-id', 'com-uuid-1', {
      semesterId: 'sem-2026',
      groupIds: ['grp-poster'],
    });
    assert.fail('Phải chặn nhóm thuộc diện Poster');
  } catch (err: any) {
    assert(
      err.message.includes('Poster'),
      `Lỗi phải nêu rõ Poster: ${err.message}`,
    );
    console.log(' -> Đã chặn thành công nhóm Poster:', err.message);
  }

  // TEST 4: Phân nhóm hợp lệ cho Hội đồng
  console.log('4. Kiểm tra phân nhóm hợp lệ cho Hội đồng...');
  const res = await service.assignGroupsToCommittee('head-id', 'com-uuid-1', {
    semesterId: 'sem-2026',
    groupIds: ['grp-valid'],
  });
  assert.equal(res.groupCount, 1, 'Số nhóm được gán phải là 1');
  assert.equal(res.assignedGroups[0].id, 'grp-valid', 'Nhóm được gán phải là grp-valid');
  console.log(' -> Phân nhóm hợp lệ thành công:', res.message);

  // TEST 5: Gỡ bỏ nhóm khi cập nhật danh sách rỗng
  console.log('5. Kiểm tra gỡ bỏ nhóm khi cập nhật danh sách rỗng...');
  const resEmpty = await service.assignGroupsToCommittee('head-id', 'com-uuid-1', {
    semesterId: 'sem-2026',
    groupIds: [],
  });
  assert.equal(resEmpty.groupCount, 0, 'Số nhóm phải là 0 sau khi gỡ');
  console.log(' -> Gỡ nhóm thành công:', resEmpty.message);

  // TEST 6: Xóa hội đồng
  console.log('6. Kiểm tra xóa hội đồng...');
  const delRes = await service.deleteDefenseCommittee('head-id', 'com-uuid-1');
  assert.equal(delRes.id, 'com-uuid-1', 'ID hội đồng xóa phải khớp');
  console.log(' -> Xóa hội đồng thành công:', delRes.message);

  console.log('\n TẤT CẢ UNIT TESTS ĐỀU THÀNH CÔNG VƯỢT TRỘI!');
}

runUnitTest().catch((err) => {
  console.error('Unit test thất bại:', err);
  process.exit(1);
});
