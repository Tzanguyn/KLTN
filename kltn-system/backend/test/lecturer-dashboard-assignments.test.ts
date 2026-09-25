import 'reflect-metadata';
import 'dotenv/config';
import { strict as assert } from 'assert';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

async function run() {
  console.log('=== TEST SUITE: LECTURER DASHBOARD & ASSIGNMENTS (WITH ANTI-CONFLICT) ===\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();
  const server = await app.listen(0);

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const prisma = app.get(PrismaService);

  try {
    console.log('1. Setting up roles, departments, semesters and test users...');
    const gvRole = await prisma.role.findUnique({ where: { code: 'GIANG_VIEN' } });
    const svRole = await prisma.role.findUnique({ where: { code: 'SINH_VIEN' } });

    assert(gvRole && svRole, 'Required roles must exist in DB');

    const dept = await prisma.department.findFirst();
    assert(dept, 'Department must exist');
    const sem =
      (await prisma.semester.findFirst({ where: { status: 'OPEN' } })) ||
      (await prisma.semester.findFirst());
    assert(sem, 'Semester must exist');

    const timestamp = Date.now();
    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash('Password123!', 10);

    // Create Lecturer A (GV A)
    const gvAUser = await prisma.user.create({
      data: {
        email: `gv_a_${timestamp}@kltn.edu.vn`,
        fullName: 'TS. Nguyễn Văn A (GVHD & GVPB)',
        phone: '0901111111',
        passwordHash: hashed,
        roles: { create: { roleId: gvRole.id } },
        lecturerProfile: {
          create: {
            lecturerCode: `GVA_${timestamp}`,
            departmentId: dept.id,
            maxGroups: 5,
          },
        },
      },
      include: { lecturerProfile: true },
    });

    // Create Lecturer B (GV B)
    const gvBUser = await prisma.user.create({
      data: {
        email: `gv_b_${timestamp}@kltn.edu.vn`,
        fullName: 'PGS. Trần Thị B (Chủ tịch HĐ)',
        phone: '0902222222',
        passwordHash: hashed,
        roles: { create: { roleId: gvRole.id } },
        lecturerProfile: {
          create: {
            lecturerCode: `GVB_${timestamp}`,
            departmentId: dept.id,
            maxGroups: 5,
          },
        },
      },
      include: { lecturerProfile: true },
    });

    // Create Student
    const svUser = await prisma.user.create({
      data: {
        email: `sv_${timestamp}@kltn.edu.vn`,
        fullName: 'Sinh Viên Test',
        passwordHash: hashed,
        roles: { create: { roleId: svRole.id } },
        studentProfile: {
          create: {
            studentCode: `SV_${timestamp}`,
            departmentId: dept.id,
            eligible: true,
          },
        },
      },
      include: { studentProfile: true },
    });

    // Login users to get JWT tokens
    const login = async (email: string) => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password: 'Password123!' }),
      });
      const data = await res.json();
      assert(res.status === 200 || res.status === 201, `Login failed for ${email}: ${JSON.stringify(data)}`);
      return data.data.accessToken;
    };

    const gvAToken = await login(`gv_a_${timestamp}@kltn.edu.vn`);
    const svToken = await login(`sv_${timestamp}@kltn.edu.vn`);

    console.log('2. Setting up Topics and Groups...');
    // Topic 1 (Guided by GV A)
    const topic1 = await prisma.topic.create({
      data: {
        title: `Đề tài 1 hướng dẫn bởi GV A - ${timestamp}`,
        status: 'APPROVED',
        ownerId: gvAUser.id,
        departmentId: dept.id,
        semesterId: sem.id,
      },
    });

    // Group 1: Guided by GV A, has 2 submissions, 1 accepted, midterm CONTINUE
    const group1 = await prisma.group.create({
      data: {
        code: `GRP1_${timestamp}`,
        name: `Nhóm Nghiên cứu 1`,
        topicId: topic1.id,
        semesterId: sem.id,
        midtermStatus: 'CONTINUE',
        members: {
          create: {
            studentId: svUser.studentProfile!.id,
            isLeader: true,
          },
        },
      },
    });

    // Add 2 submissions for Group 1
    const sub1 = await prisma.submission.create({
      data: {
        groupId: group1.id,
        submittedBy: svUser.id,
        fileName: 'BaoCaoTienDo_Dot1.pdf',
        status: 'ACCEPTED',
      },
    });
    const sub2 = await prisma.submission.create({
      data: {
        groupId: group1.id,
        submittedBy: svUser.id,
        fileName: 'BaoCaoTienDo_Dot2.pdf',
        status: 'SUBMITTED',
      },
    });

    // Topic 2 (Guided by GV A)
    const topic2 = await prisma.topic.create({
      data: {
        title: `Đề tài 2 hướng dẫn bởi GV A - ${timestamp}`,
        status: 'APPROVED',
        ownerId: gvAUser.id,
        departmentId: dept.id,
        semesterId: sem.id,
      },
    });

    // Group 2: Guided by GV A, 0 submissions -> triggers delay warning!
    const group2 = await prisma.group.create({
      data: {
        code: `GRP2_${timestamp}`,
        name: `Nhóm Nghiên cứu 2`,
        topicId: topic2.id,
        semesterId: sem.id,
        midtermStatus: 'PENDING',
      },
    });

    // Topic 3 (Guided by GV B, GV A is Reviewer / GVPB)
    const topic3 = await prisma.topic.create({
      data: {
        title: `Đề tài 3 phản biện bởi GV A - ${timestamp}`,
        summary: 'Hệ thống nhận diện biển số xe sử dụng YOLOv8',
        technologies: 'Python, PyTorch, FastAPI',
        status: 'APPROVED',
        ownerId: gvBUser.id,
        reviewerId: gvAUser.id,
        departmentId: dept.id,
        semesterId: sem.id,
      },
    });

    const group3 = await prisma.group.create({
      data: {
        code: `GRP3_${timestamp}`,
        name: `Nhóm Nghiên cứu 3`,
        topicId: topic3.id,
        semesterId: sem.id,
        reviewerAssignments: {
          create: {
            lecturerId: gvAUser.lecturerProfile!.id,
            assignedBy: gvBUser.id,
            type: 'PRIMARY',
          },
        },
      },
    });

    // Submission for group 3 for reviewer to review
    await prisma.submission.create({
      data: {
        groupId: group3.id,
        submittedBy: svUser.id,
        fileName: 'KhoaLuanTotNghiep_Nhom3.pdf',
        status: 'SUBMITTED',
      },
    });

    // Topic 4 (Guided by GV B)
    const topic4 = await prisma.topic.create({
      data: {
        title: `Đề tài 4 của GV B bảo vệ hội đồng - ${timestamp}`,
        status: 'APPROVED',
        ownerId: gvBUser.id,
        departmentId: dept.id,
        semesterId: sem.id,
      },
    });

    const group4 = await prisma.group.create({
      data: {
        code: `GRP4_${timestamp}`,
        name: `Nhóm Nghiên cứu 4`,
        topicId: topic4.id,
        semesterId: sem.id,
      },
    });

    console.log('3. Setting up Defense Committee and Schedules...');
    // Committee C: GV A and GV B
    const committee = await prisma.defenseCommittee.create({
      data: {
        name: `Hội đồng Chấm KLTN Số 1 - ${timestamp}`,
        departmentId: dept.id,
        members: {
          create: [
            { userId: gvBUser.id, role: 'Chủ tịch' },
            { userId: gvAUser.id, role: 'Ủy viên' },
          ],
        },
      },
    });

    // Schedules for Committee C:
    // Schedule 1: Group 1 (Guided by GV A -> MUST BE FILTERED OUT FOR GV A)
    await prisma.defenseSchedule.create({
      data: {
        groupId: group1.id,
        semesterId: sem.id,
        committeeId: committee.id,
        room: 'P. Hội thảo A',
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        status: 'SCHEDULED',
      },
    });

    // Schedule 2: Group 2 (Guided by GV A -> MUST BE FILTERED OUT FOR GV A)
    await prisma.defenseSchedule.create({
      data: {
        groupId: group2.id,
        semesterId: sem.id,
        committeeId: committee.id,
        room: 'P. Hội thảo A',
        startsAt: new Date(Date.now() + 93600000),
        endsAt: new Date(Date.now() + 97200000),
        status: 'SCHEDULED',
      },
    });

    // Schedule 3: Group 4 (Guided by GV B -> MUST BE PRESENT FOR GV A)
    await prisma.defenseSchedule.create({
      data: {
        groupId: group4.id,
        semesterId: sem.id,
        committeeId: committee.id,
        room: 'P. Hội thảo A',
        startsAt: new Date(Date.now() + 100800000),
        endsAt: new Date(Date.now() + 104400000),
        status: 'SCHEDULED',
      },
    });

    console.log('Setup finished.\n');

    // ==========================================
    // TEST 1: GET /api/lecturers/me/dashboard
    // ==========================================
    console.log('--- TEST 1: GET /api/lecturers/me/dashboard ---');
    const dashRes = await fetch(`${baseUrl}/lecturers/me/dashboard`, {
      headers: { Authorization: `Bearer ${gvAToken}` },
    });
    assert.equal(dashRes.status, 200, 'Dashboard endpoint should return 200 OK');
    const dashBody = await dashRes.json();
    assert.equal(dashBody.success, true);
    const dashData = dashBody.data;

    console.log(' -> soNhomHuongDan:', dashData.soNhomHuongDan);
    assert.equal(dashData.soNhomHuongDan, 2, 'Should guide exactly 2 groups');
    assert.equal(dashData.maxGroupsQuota, 5, 'Quota should be 5');
    assert.equal(dashData.choTrong, 3, 'Available slots should be 3');

    console.log(' -> phanTramHoanThanhTrungBinh:', dashData.phanTramHoanThanhTrungBinh);
    assert(dashData.phanTramHoanThanhTrungBinh > 0, 'Average progress should be > 0');

    console.log(' -> soLanNop:', dashData.soLanNop);
    assert.equal(dashData.soLanNop.tong, 2, 'Total submissions across guided groups should be 2');
    assert.equal(dashData.soLanNop.daDuyet, 1, 'Accepted submissions count should be 1');
    assert.equal(dashData.soLanNop.dangXem, 1, 'Reviewing submissions count should be 1');

    console.log(' -> canhBaoChamTienDo:', dashData.canhBaoChamTienDo);
    assert(dashData.canhBaoChamTienDo.length >= 1, 'Should have delay warning for Group 2 (0 submissions)');
    const hasGrp2Warning = dashData.canhBaoChamTienDo.some(
      (w: any) => w.groupId === group2.id && w.reason.includes('Chưa có bất kỳ bài nộp'),
    );
    assert(hasGrp2Warning, 'Should explicitly warn about Group 2 having 0 submissions');

    console.log(' -> trangThaiGiuaKy:', dashData.trangThaiGiuaKy);
    assert.equal(dashData.trangThaiGiuaKy.choLamTiep, 1, 'Group 1 CONTINUE count should be 1');
    assert.equal(dashData.trangThaiGiuaKy.chuaDanhGia, 1, 'Group 2 PENDING count should be 1');
    console.log('Passed Test 1: Lecturer Dashboard metrics verified.\n');

    // ==========================================
    // TEST 2: GET /api/lecturers/me/review-assignments
    // ==========================================
    console.log('--- TEST 2: GET /api/lecturers/me/review-assignments ---');
    const revRes = await fetch(`${baseUrl}/lecturers/me/review-assignments`, {
      headers: { Authorization: `Bearer ${gvAToken}` },
    });
    assert.equal(revRes.status, 200, 'Review assignments endpoint should return 200 OK');
    const revBody = await revRes.json();
    assert.equal(revBody.success, true);
    const revList = revBody.data;

    console.log(' -> review assignments count:', revList.length);
    assert.equal(revList.length, 1, 'Should have exactly 1 review assignment (Group 3)');
    const rev3 = revList[0];
    assert.equal(rev3.groupId, group3.id);
    assert.equal(rev3.groupCode, group3.code);
    assert.equal(rev3.supervisor.id, gvBUser.id, 'Supervisor must be GV B');
    assert.equal(rev3.supervisor.fullName, gvBUser.fullName);
    assert.equal(rev3.latestSubmission.fileName, 'KhoaLuanTotNghiep_Nhom3.pdf');
    assert.equal(rev3.scoring.hasScored, false);
    console.log('Passed Test 2: Lecturer Review Assignments verified.\n');

    // ==========================================
    // TEST 3: GET /api/lecturers/me/committee-assignments (ANTI-CONFLICT VERIFICATION)
    // ==========================================
    console.log('--- TEST 3: GET /api/lecturers/me/committee-assignments (STRICT ANTI-CONFLICT) ---');
    const comRes = await fetch(`${baseUrl}/lecturers/me/committee-assignments`, {
      headers: { Authorization: `Bearer ${gvAToken}` },
    });
    assert.equal(comRes.status, 200, 'Committee assignments endpoint should return 200 OK');
    const comBody = await comRes.json();
    assert.equal(comBody.success, true);
    const comList = comBody.data;

    console.log(' -> committees count:', comList.length);
    assert.equal(comList.length, 1, 'GV A is member of 1 committee');
    const myCom = comList[0];
    assert.equal(myCom.committeeId, committee.id);
    assert.equal(myCom.myRole, 'Ủy viên');

    console.log(' -> total committee schedules in DB:', myCom.totalSchedules);
    assert.equal(myCom.totalSchedules, 3, 'Committee has 3 total schedules in DB');

    console.log(' -> evaluable schedules returned to GV A:', myCom.schedules.length);
    assert.equal(myCom.schedules.length, 1, 'GV A must ONLY receive 1 evaluable schedule (Group 4)');
    assert.equal(myCom.schedules[0].group.id, group4.id, 'The single visible group must be Group 4');
    assert.equal(myCom.schedules[0].group.supervisor.id, gvBUser.id, 'Group 4 supervisor must be GV B');

    console.log(' -> excludedGuidedGroupsCount:', myCom.excludedGuidedGroupsCount);
    assert.equal(myCom.excludedGuidedGroupsCount, 2, 'Exactly 2 guided groups (Group 1 & 2) must be excluded');
    assert.equal(myCom.antiConflictProtected, true, 'antiConflictProtected flag must be true');

    // Explicit check: Group 1 and Group 2 NEVER leak into GV A schedules
    const leakedGuidedGroups = myCom.schedules.filter(
      (s: any) => s.group.id === group1.id || s.group.id === group2.id,
    );
    assert.equal(leakedGuidedGroups.length, 0, 'ZERO guided groups may appear in committee schedules!');
    console.log('Passed Test 3: Anti-conflict rule strictly enforced (guided groups filtered 100%).\n');

    // ==========================================
    // TEST 4: RBAC Security Checks (Student forbidden)
    // ==========================================
    console.log('--- TEST 4: RBAC Access Control Verification ---');
    const svDashRes = await fetch(`${baseUrl}/lecturers/me/dashboard`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    assert.equal(svDashRes.status, 403, 'Student must be 403 Forbidden from accessing lecturer dashboard');

    const svRevRes = await fetch(`${baseUrl}/lecturers/me/review-assignments`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    assert.equal(svRevRes.status, 403, 'Student must be 403 Forbidden from accessing review assignments');

    const svComRes = await fetch(`${baseUrl}/lecturers/me/committee-assignments`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    assert.equal(svComRes.status, 403, 'Student must be 403 Forbidden from accessing committee assignments');

    const anonRes = await fetch(`${baseUrl}/lecturers/me/dashboard`);
    assert.equal(anonRes.status, 401, 'Anonymous user must be 401 Unauthorized');
    console.log('Passed Test 4: RBAC access control verified.\n');

    console.log('========================================================================');
    console.log('ALL 4/4 LECTURER DASHBOARD & ASSIGNMENTS INTEGRATION TESTS PASSED!');
    console.log('========================================================================\n');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
