import 'reflect-metadata';
import 'dotenv/config';
import * as assert from 'node:assert';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

async function runTests() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();
  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  console.log(`Running defense-info integration tests on port ${port}...`);

  const prisma = app.get(PrismaService);

  // Helper login
  async function login(identifier: string, password = 'Password@123') {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const json = await res.json();
    assert.equal(res.status, 201, `Login failed for ${identifier}: ${JSON.stringify(json)}`);
    return json.data.accessToken as string;
  }

  // 1. Logins
  const svToken = await login('sinhvien@kltn.edu.vn'); // Assigned to group/topic
  const svOutsiderToken = await login('sinhvien2@kltn.edu.vn'); // Ineligible / no topic
  const gvToken = await login('giangvien@kltn.edu.vn'); // Lecturer

  const svUser = await prisma.user.findUnique({
    where: { email: 'sinhvien@kltn.edu.vn' },
    include: { studentProfile: true },
  });
  const gvUser = await prisma.user.findUnique({
    where: { email: 'giangvien@kltn.edu.vn' },
    include: { lecturerProfile: true },
  });
  assert(svUser && gvUser);

  // Test 1: Non-student forbidden from /students/me/defense-info
  console.log('1. Testing RBAC: Lecturer access to /students/me/defense-info must return 403 Forbidden...');
  const rbacRes = await fetch(`${baseUrl}/students/me/defense-info`, {
    headers: { Authorization: `Bearer ${gvToken}` },
  });
  assert.equal(rbacRes.status, 403, 'Lecturer must receive 403 Forbidden');
  console.log(' -> RBAC guard verified (403 Forbidden).');

  // Test 2: Student without topic/group
  console.log('2. Testing student without topic/group...');
  const noTopicRes = await fetch(`${baseUrl}/students/me/defense-info`, {
    headers: { Authorization: `Bearer ${svOutsiderToken}` },
  });
  assert.equal(noTopicRes.status, 200);
  const noTopicData = await noTopicRes.json();
  assert.deepEqual(noTopicData.data.danhSachGVPB, []);
  assert.equal(noTopicData.data.lichBaoVe, null);
  assert.equal(noTopicData.data.diemChiTiet, null);
  assert.equal(noTopicData.data.ketQuaCuoiCung, null);
  console.log(' -> Student without topic properly returns empty/null fields.');

  // Setup test environment for assigned student
  // Find group of student
  const groupMember = await prisma.groupMember.findFirst({
    where: { studentId: svUser.studentProfile!.id },
    include: { group: { include: { topic: true } } },
  });
  assert(groupMember && groupMember.group, 'Student SV2026001 must have a group');
  const group = groupMember.group;

  // Clean up any test defense schedules & scores for idempotency
  await prisma.defenseSchedule.deleteMany({ where: { groupId: group.id } });
  await prisma.reviewerAssignment.deleteMany({ where: { groupId: group.id } });
  await prisma.score.deleteMany({ where: { groupId: group.id } });

  // Test 3: Before reviewer assignment and before schedule -> empty danhSachGVPB, null lichBaoVe
  console.log('3. Testing before reviewer assignment and schedule...');
  const initialRes = await fetch(`${baseUrl}/students/me/defense-info`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  assert.equal(initialRes.status, 200);
  const initialData = await initialRes.json();
  assert(Array.isArray(initialData.data.danhSachGVPB));
  assert.equal(initialData.data.lichBaoVe, null, 'lichBaoVe must be null before schedule');
  assert.equal(initialData.data.diemChiTiet, null, 'diemChiTiet must be null before scores published');
  assert.equal(initialData.data.ketQuaCuoiCung, null);
  console.log(' -> Initial unassigned state verified.');

  // Test 4: Assign Reviewer (GVPB)
  console.log('4. Testing after GVPB assignment...');
  // Find another lecturer to be reviewer
  const tbmUser = await prisma.user.findUnique({
    where: { email: 'truongbomon@kltn.edu.vn' },
    include: { lecturerProfile: true },
  });
  assert(tbmUser && tbmUser.lecturerProfile);

  await prisma.reviewerAssignment.create({
    data: {
      groupId: group.id,
      lecturerId: tbmUser.lecturerProfile.id,
      assignedBy: tbmUser.id,
      type: 'PRIMARY',
    },
  });

  const reviewerRes = await fetch(`${baseUrl}/students/me/defense-info`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const reviewerData = await reviewerRes.json();
  assert.equal(reviewerRes.status, 200);
  assert.equal(reviewerData.data.danhSachGVPB.length, 1);
  assert.equal(reviewerData.data.danhSachGVPB[0].hoTen, tbmUser.fullName);
  assert.equal(reviewerData.data.danhSachGVPB[0].email, tbmUser.email);
  assert.equal(reviewerData.data.danhSachGVPB[0].vaiTro, 'Phản biện chính');
  console.log(' -> danhSachGVPB verified with assigned reviewer.');

  // Test 5: Defense Schedule in DRAFT status -> lichBaoVe must still be null (not published)
  console.log('5. Testing defense schedule in DRAFT status (must remain null)...');
  const sem = await prisma.semester.findFirst({ where: { status: 'OPEN' } });
  const dept = await prisma.department.findFirst();

  let committee = await prisma.defenseCommittee.findFirst({
    include: { members: { include: { user: true } } },
  });
  if (!committee) {
    committee = await prisma.defenseCommittee.create({
      data: {
        name: 'Hội đồng chấm KLTN 01',
        departmentId: dept!.id,
      },
      include: { members: { include: { user: true } } },
    });
  }

  const draftSchedule = await prisma.defenseSchedule.create({
    data: {
      groupId: group.id,
      semesterId: sem!.id,
      committeeId: committee.id,
      room: 'Hội trường B4',
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10 + 1000 * 60 * 60 * 2),
      status: 'DRAFT',
    },
  });

  const draftRes = await fetch(`${baseUrl}/students/me/defense-info`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const draftData = await draftRes.json();
  assert.equal(draftData.data.lichBaoVe, null, 'lichBaoVe must be null when schedule is DRAFT');
  console.log(' -> DRAFT schedule correctly hidden (lichBaoVe: null).');

  // Test 6: Defense Schedule SCHEDULED -> lichBaoVe is published
  console.log('6. Testing defense schedule SCHEDULED...');
  await prisma.defenseSchedule.update({
    where: { id: draftSchedule.id },
    data: { status: 'SCHEDULED' },
  });

  const schedRes = await fetch(`${baseUrl}/students/me/defense-info`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const schedData = await schedRes.json();
  assert(schedData.data.lichBaoVe, 'lichBaoVe must be present when SCHEDULED');
  assert.equal(schedData.data.lichBaoVe.phong, 'Hội trường B4');
  assert.equal(schedData.data.lichBaoVe.hinhThuc, 'TRUC_TIEP');
  assert(Array.isArray(schedData.data.lichBaoVe.thanhVienHoiDong));
  console.log(' -> lichBaoVe verified (room, mode, date, committee members).');

  // Test 7: Scores in DRAFT status -> diemChiTiet must remain null
  console.log('7. Testing scores in DRAFT status (must remain null)...');
  const criteria = await prisma.scoreCriterion.findMany({
    where: { code: { in: ['CONTENT', 'IMPLEMENTATION', 'PRESENTATION'] } },
  });
  assert(criteria.length >= 3, 'Must have criteria seeded');

  // GVHD creates draft score
  await prisma.score.create({
    data: {
      groupId: group.id,
      criterionId: criteria[0].id,
      scorerId: gvUser.id,
      value: 8.5,
      status: 'DRAFT',
    },
  });

  const draftScoreRes = await fetch(`${baseUrl}/students/me/defense-info`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const draftScoreData = await draftScoreRes.json();
  assert.equal(draftScoreData.data.diemChiTiet, null, 'DRAFT scores must not be displayed');
  assert.equal(draftScoreData.data.ketQuaCuoiCung, null);
  console.log(' -> DRAFT scores correctly hidden (diemChiTiet: null).');

  // Test 8: Submit published scores (GVHD, GVPB, and Committee)
  console.log('8. Testing published scores and final result calculation...');
  await prisma.score.deleteMany({ where: { groupId: group.id } });

  // GVHD scores (3 criteria)
  // Content (40%) = 9.0, Impl (30%) = 8.5, Pres (30%) = 8.0 -> GVHD Tong = 8.55
  for (const c of criteria) {
    const val = c.code === 'CONTENT' ? 9.0 : c.code === 'IMPLEMENTATION' ? 8.5 : 8.0;
    await prisma.score.create({
      data: {
        groupId: group.id,
        criterionId: c.id,
        scorerId: gvUser.id,
        value: val,
        status: 'SUBMITTED',
      },
    });
  }

  // GVPB scores (3 criteria)
  // Content (40%) = 8.0, Impl (30%) = 8.0, Pres (30%) = 8.0 -> GVPB Tong = 8.0
  for (const c of criteria) {
    await prisma.score.create({
      data: {
        groupId: group.id,
        criterionId: c.id,
        scorerId: tbmUser.id,
        value: 8.0,
        status: 'SUBMITTED',
      },
    });
  }

  // Committee member score (quanly)
  const qlUser = await prisma.user.findUnique({ where: { email: 'quanly@kltn.edu.vn' } });
  assert(qlUser);
  for (const c of criteria) {
    await prisma.score.create({
      data: {
        groupId: group.id,
        criterionId: c.id,
        scorerId: qlUser.id,
        value: 9.0,
        status: 'SUBMITTED',
      },
    });
  }

  const finalRes = await fetch(`${baseUrl}/students/me/defense-info`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  assert.equal(finalRes.status, 200);
  const finalData = await finalRes.json();
  const info = finalData.data;

  assert(info.diemChiTiet, 'diemChiTiet must be present');
  assert(info.diemChiTiet.diemHuongDan, 'diemHuongDan must be present');
  assert.equal(info.diemChiTiet.diemHuongDan.tieuChi.length, 3);
  assert.equal(info.diemChiTiet.diemHuongDan.tong, 8.55);

  assert(info.diemChiTiet.diemPhanBien, 'diemPhanBien must be present');
  assert.equal(info.diemChiTiet.diemPhanBien.tieuChi.length, 3);
  assert.equal(info.diemChiTiet.diemPhanBien.tong, 8.0);

  assert(info.diemChiTiet.diemHoiDong, 'diemHoiDong must be present');
  assert.equal(info.diemChiTiet.diemHoiDong.tong, 9.0);

  // diemTongKet = 8.55 * 0.3 + 8.0 * 0.3 + 9.0 * 0.4 = 2.565 + 2.40 + 3.60 = 8.565 -> 8.57
  assert(typeof info.diemChiTiet.diemTongKet === 'number');
  assert(info.diemChiTiet.diemTongKet >= 8.5 && info.diemChiTiet.diemTongKet <= 8.6);
  assert(typeof info.diemChiTiet.congThucTinh === 'string');
  assert.equal(info.ketQuaCuoiCung, 'DAT', 'Score >= 5.0 must yield ketQuaCuoiCung: DAT');

  console.log(` -> Full defense-info verified!
      GVPB count: ${info.danhSachGVPB.length}
      Defense Room: ${info.lichBaoVe.phong}
      Điểm GVHD: ${info.diemChiTiet.diemHuongDan.tong}
      Điểm GVPB: ${info.diemChiTiet.diemPhanBien.tong}
      Điểm Hội đồng: ${info.diemChiTiet.diemHoiDong.tong}
      Điểm Tổng kết: ${info.diemChiTiet.diemTongKet}
      Công thức tính: ${info.diemChiTiet.congThucTinh}
      Kết quả cuối cùng: ${info.ketQuaCuoiCung}`);

  // Test 9: Failing score test (diemTongKet < 5.0 -> KHONG_DAT)
  console.log('9. Testing failing grade yields ketQuaCuoiCung: KHONG_DAT...');
  await prisma.score.updateMany({
    where: { groupId: group.id },
    data: { value: 3.5 },
  });

  const failRes = await fetch(`${baseUrl}/students/me/defense-info`, {
    headers: { Authorization: `Bearer ${svToken}` },
  });
  const failData = await failRes.json();
  assert.equal(failData.data.ketQuaCuoiCung, 'KHONG_DAT');
  console.log(' -> Failing score verified (ketQuaCuoiCung: KHONG_DAT).');

  await app.close();
  console.log('\n======================================================');
  console.log('ALL DEFENSE-INFO TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

