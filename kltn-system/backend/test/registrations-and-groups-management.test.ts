import 'reflect-metadata';
import 'dotenv/config';
import * as assert from 'node:assert';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { RoleCode, UserStatus } from '@prisma/client';

async function runTest() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();
  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  console.log(`Starting Registrations & Groups Management Integration Test on port ${port}...`);

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

  try {
    const headToken = await login('truongbomon@kltn.edu.vn');
    const gvToken = await login('giangvien@kltn.edu.vn');
    const svToken = await login('sinhvien@kltn.edu.vn');

    // Get active semester
    const activeSemester = await prisma.semester.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    assert.ok(activeSemester, 'Active semester must exist');
    const departmentId = activeSemester.departmentId;

    // Ensure MAX_GROUP_SIZE is set to 2 for deterministic testing
    await prisma.systemConfig.upsert({
      where: {
        key_semesterId_departmentId: {
          key: 'MAX_GROUP_SIZE',
          semesterId: activeSemester.id,
          departmentId,
        },
      },
      update: { value: 2 },
      create: {
        key: 'MAX_GROUP_SIZE',
        value: 2,
        semesterId: activeSemester.id,
        departmentId,
      },
    });

    // Create temporary students for isolated testing
    const passwordHash = await bcrypt.hash('Password@123', 10);
    const svRole = await prisma.role.findUnique({ where: { code: RoleCode.SINH_VIEN } });
    assert.ok(svRole);
    const svRoleId = svRole.id;

    async function createTestStudent(code: string, email: string, className: string) {
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            fullName: `Test SV ${code}`,
            passwordHash,
            status: UserStatus.ACTIVE,
          },
        });
        await prisma.userRole.create({
          data: { userId: user.id, roleId: svRoleId },
        });
      }

      let profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
      if (!profile) {
        profile = await prisma.studentProfile.create({
          data: {
            userId: user.id,
            studentCode: code,
            className,
            cohort: 2026,
            departmentId,
            creditsEarned: 130,
            gpa: 3.5,
            eligible: true,
          },
        });
      } else {
        profile = await prisma.studentProfile.update({
          where: { id: profile.id },
          data: { className, departmentId },
        });
      }
      return { user, profile };
    }

    const st1 = await createTestStudent('TEST_SV_G1', 'test_sv_g1@kltn.edu.vn', 'CNTT_K26A');
    const st2 = await createTestStudent('TEST_SV_G2', 'test_sv_g2@kltn.edu.vn', 'CNTT_K26A');
    const st3 = await createTestStudent('TEST_SV_G3', 'test_sv_g3@kltn.edu.vn', 'HTTT_K26B');

    // Clean up any prior group memberships for these test students
    await prisma.groupMember.deleteMany({
      where: { studentId: { in: [st1.profile.id, st2.profile.id, st3.profile.id] } },
    });

    // =========================================================================
    // PART 1: GET /registrations?semesterId=&lop=&nganh=&status=
    // =========================================================================
    console.log('\n--- PART 1: Testing GET /registrations filters ---');

    // Create a known registration for st1
    await prisma.registration.deleteMany({
      where: { studentId: st1.profile.id, semesterId: activeSemester.id },
    });
    const testReg = await prisma.registration.create({
      data: {
        studentId: st1.profile.id,
        semesterId: activeSemester.id,
        status: 'CHO_XAC_NHAN',
        proposal: 'Đề tài thử nghiệm lọc đăng ký',
      },
    });

    // 1.1: Filter by semesterId
    const resRegSem = await fetch(`${baseUrl}/registrations?semesterId=${activeSemester.id}`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(resRegSem.status, 200, 'GET /registrations?semesterId= must return 200');
    const jsonRegSem = await resRegSem.json();
    assert.ok(Array.isArray(jsonRegSem.data), 'Data must be an array');
    assert.ok(
      jsonRegSem.data.some((r: any) => r.id === testReg.id),
      'Must contain test registration by semesterId',
    );
    console.log(' -> 1.1 GET /registrations?semesterId= passed');

    // 1.2: Filter by lop
    const resRegLop = await fetch(`${baseUrl}/registrations?lop=CNTT_K26A`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(resRegLop.status, 200, 'GET /registrations?lop= must return 200');
    const jsonRegLop = await resRegLop.json();
    assert.ok(
      jsonRegLop.data.some((r: any) => r.id === testReg.id),
      'Must contain test registration by lop',
    );
    console.log(' -> 1.2 GET /registrations?lop= passed');

    // 1.3: Filter by status
    const resRegStatus = await fetch(`${baseUrl}/registrations?status=CHO_XAC_NHAN`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(resRegStatus.status, 200, 'GET /registrations?status= must return 200');
    const jsonRegStatus = await resRegStatus.json();
    assert.ok(
      jsonRegStatus.data.some((r: any) => r.id === testReg.id),
      'Must contain test registration by status',
    );
    console.log(' -> 1.3 GET /registrations?status= passed');

    // 1.4: Filter by nganh
    const resRegNganh = await fetch(`${baseUrl}/registrations?nganh=${activeSemester.department.code}`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(resRegNganh.status, 200, 'GET /registrations?nganh= must return 200');
    const jsonRegNganh = await resRegNganh.json();
    assert.ok(
      jsonRegNganh.data.some((r: any) => r.id === testReg.id),
      'Must contain test registration by nganh',
    );
    console.log(' -> 1.4 GET /registrations?nganh= passed');

    // 1.5: Combined filters
    const resRegCombined = await fetch(
      `${baseUrl}/registrations?semesterId=${activeSemester.id}&lop=CNTT_K26A&status=CHO_XAC_NHAN`,
      { headers: { Authorization: `Bearer ${headToken}` } },
    );
    assert.equal(resRegCombined.status, 200);
    const jsonRegCombined = await resRegCombined.json();
    assert.ok(jsonRegCombined.data.some((r: any) => r.id === testReg.id));
    console.log(' -> 1.5 GET /registrations combined filters passed');

    // 1.6: Non-matching filter returns empty
    const resRegNone = await fetch(`${baseUrl}/registrations?lop=NON_EXISTENT_CLASS_XYZ`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(resRegNone.status, 200);
    const jsonRegNone = await resRegNone.json();
    assert.equal(jsonRegNone.data.length, 0, 'Non-existent class must return empty array');
    console.log(' -> 1.6 GET /registrations non-matching filter passed');

    // =========================================================================
    // PART 2: GET /groups?semesterId= and GET /groups/:id
    // =========================================================================
    console.log('\n--- PART 2: Testing GET /groups?semesterId= & GET /groups/:id ---');

    // Create test groups
    const groupA = await prisma.group.create({
      data: {
        code: `GRP_TEST_${Date.now()}_A`,
        name: 'Nhóm KLTN Thử Nghiệm A',
        semesterId: activeSemester.id,
        status: 'FORMING',
      },
    });

    const resGroupsSem = await fetch(`${baseUrl}/groups?semesterId=${activeSemester.id}`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(resGroupsSem.status, 200, 'GET /groups?semesterId= must return 200');
    const jsonGroupsSem = await resGroupsSem.json();
    assert.ok(
      jsonGroupsSem.data.some((g: any) => g.id === groupA.id),
      'Must contain created groupA',
    );
    console.log(' -> 2.1 GET /groups?semesterId= passed');

    // Single group GET /groups/:id
    const resGroupDetail = await fetch(`${baseUrl}/groups/${groupA.id}`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(resGroupDetail.status, 200, 'GET /groups/:id must return 200');
    const jsonGroupDetail = await resGroupDetail.json();
    assert.equal(jsonGroupDetail.data.id, groupA.id);
    assert.equal(jsonGroupDetail.data.name, groupA.name);
    console.log(' -> 2.2 GET /groups/:id passed');

    // =========================================================================
    // PART 3: PATCH /groups/:id (cập nhật thông tin khi được phép)
    // =========================================================================
    console.log('\n--- PART 3: Testing PATCH /groups/:id ---');

    // 3.1: Update name and status by Manager
    const patchRes = await fetch(`${baseUrl}/groups/${groupA.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        name: 'Nhóm KLTN Thử Nghiệm A Đã Đổi Tên',
        status: 'ACTIVE',
      }),
    });
    assert.equal(patchRes.status, 200, 'PATCH /groups/:id must return 200');
    const patchJson = await patchRes.json();
    assert.equal(patchJson.data.name, 'Nhóm KLTN Thử Nghiệm A Đã Đổi Tên');
    assert.equal(patchJson.data.status, 'ACTIVE');
    console.log(' -> 3.1 PATCH /groups/:id (name & status) passed');

    // 3.2: Unauthorized update (SV trying to change status)
    const svPatchRes = await fetch(`${baseUrl}/groups/${groupA.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        status: 'COMPLETED',
      }),
    });
    assert.equal(
      svPatchRes.status,
      403,
      'Unauthorized student changing group status must return 403 Forbidden',
    );
    console.log(' -> 3.2 Unauthorized PATCH returned 403 as expected');

    // =========================================================================
    // PART 4: Check constraints (Số lượng thành viên & SV không thuộc 2 nhóm)
    // =========================================================================
    console.log('\n--- PART 4: Testing Member count limit & 2-Group restriction ---');

    // Add st1 to groupA
    const addSt1Res = await fetch(`${baseUrl}/groups/${groupA.id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({ studentId: st1.profile.id, isLeader: true }),
    });
    assert.equal(addSt1Res.status, 201, 'Adding st1 to groupA must return 201');

    // Add st2 to groupA (maxSize is 2, so this reaches limit 2/2)
    const addSt2Res = await fetch(`${baseUrl}/groups/${groupA.id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({ studentId: st2.profile.id, isLeader: false }),
    });
    assert.equal(addSt2Res.status, 201, 'Adding st2 to groupA must return 201');

    // 4.1: Attempt to add 3rd member (st3) -> should exceed max limit of 2
    const addSt3FailRes = await fetch(`${baseUrl}/groups/${groupA.id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({ studentId: st3.profile.id }),
    });
    assert.equal(
      addSt3FailRes.status,
      400,
      'Exceeding MAX_GROUP_SIZE must return 400 Bad Request',
    );
    const addSt3FailJson = await addSt3FailRes.json();
    assert.ok(
      addSt3FailJson.message?.includes('tối đa') || addSt3FailJson.message?.includes('quy định'),
      `Error message should mention limit: ${JSON.stringify(addSt3FailJson)}`,
    );
    console.log(' -> 4.1 Exceeding MAX_GROUP_SIZE returned 400 as expected');

    // 4.2: Create groupB in the same semester and attempt to add st1 (who is already in groupA)
    const groupB = await prisma.group.create({
      data: {
        code: `GRP_TEST_${Date.now()}_B`,
        name: 'Nhóm KLTN Thử Nghiệm B',
        semesterId: activeSemester.id,
        status: 'FORMING',
      },
    });

    const addSt1ToGroupBRes = await fetch(`${baseUrl}/groups/${groupB.id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({ studentId: st1.profile.id }),
    });
    assert.equal(
      addSt1ToGroupBRes.status,
      409,
      'Adding student who is already in another group must return 409 Conflict',
    );
    const addSt1ToGroupBJson = await addSt1ToGroupBRes.json();
    assert.ok(
      addSt1ToGroupBJson.message?.includes('2 nhóm') ||
        addSt1ToGroupBJson.message?.includes('nhóm khác'),
      `Error message should mention student already in another group: ${JSON.stringify(
        addSt1ToGroupBJson,
      )}`,
    );
    console.log(' -> 4.2 Student already in another group returned 409 Conflict as expected');

    // 4.3: Bulk sync via PATCH /groups/:id checking 2-group restriction
    const patchSyncFailRes = await fetch(`${baseUrl}/groups/${groupB.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        memberIds: [st1.profile.id, st3.profile.id],
      }),
    });
    assert.equal(
      patchSyncFailRes.status,
      409,
      'PATCH memberIds containing student from another group must return 409 Conflict',
    );
    console.log(' -> 4.3 PATCH memberIds 2-group check returned 409 Conflict as expected');

    // 4.4: Bulk sync via PATCH /groups/:id checking size limit
    const patchSyncExceedRes = await fetch(`${baseUrl}/groups/${groupB.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        memberIds: [st2.profile.id, st3.profile.id, st1.profile.id], // 3 members > max 2
      }),
    });
    assert.ok(
      [400, 409].includes(patchSyncExceedRes.status),
      'PATCH memberIds exceeding capacity must return 400 or 409',
    );
    console.log(' -> 4.4 PATCH memberIds capacity check verified');

    // 4.5: Valid PATCH memberIds with single st3 into groupB
    const patchSyncSuccessRes = await fetch(`${baseUrl}/groups/${groupB.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        memberIds: [st3.profile.id],
        leaderId: st3.profile.id,
      }),
    });
    assert.equal(patchSyncSuccessRes.status, 200, 'Valid member sync must return 200');
    const patchSyncSuccessJson = await patchSyncSuccessRes.json();
    assert.equal(patchSyncSuccessJson.data.members.length, 1);
    assert.equal(patchSyncSuccessJson.data.members[0].studentId, st3.profile.id);
    assert.equal(patchSyncSuccessJson.data.members[0].isLeader, true);
    console.log(' -> 4.5 Valid member sync and leader assignment verified');

    // Clean up
    await prisma.groupMember.deleteMany({
      where: { groupId: { in: [groupA.id, groupB.id] } },
    });
    await prisma.registration.deleteMany({
      where: { id: testReg.id },
    });
    await prisma.group.deleteMany({
      where: { id: { in: [groupA.id, groupB.id] } },
    });

    console.log('\nAll Registrations & Groups Management tests passed successfully! 🎉');
  } finally {
    await app.close();
  }
}

runTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
