import 'reflect-metadata';
import 'dotenv/config';
import * as assert from 'node:assert';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import * as bcrypt from 'bcrypt';

async function runTests() {
  console.log('=== TEST SUITE: DEFENSE ELIGIBILITY & SCORES MANAGEMENT & INCOMPLETE WARNINGS ===\n');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();
  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  console.log(`Server started on port ${port}...\n`);
  const prisma = app.get(PrismaService);

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
    // 1. Setup users & authenticate
    console.log('1. Setting up users and tokens...');
    const headToken = await login('truongbomon@kltn.edu.vn');
    const gv1Token = await login('giangvien@kltn.edu.vn');
    const gv2Token = await login('giangvien2@kltn.edu.vn');
    const svToken = await login('sinhvien@kltn.edu.vn');

    const gv1User = await prisma.user.findUnique({
      where: { email: 'giangvien@kltn.edu.vn' },
      include: { lecturerProfile: true },
    });
    assert(gv1User?.lecturerProfile);

    const gv2User = await prisma.user.findUnique({
      where: { email: 'giangvien2@kltn.edu.vn' },
      include: { lecturerProfile: true },
    });
    assert(gv2User?.lecturerProfile);

    const tbmUser = await prisma.user.findUnique({
      where: { email: 'truongbomon@kltn.edu.vn' },
      include: { lecturerProfile: true },
    });
    assert(tbmUser?.lecturerProfile);

    const svUser = await prisma.user.findUnique({
      where: { email: 'sinhvien@kltn.edu.vn' },
      include: { studentProfile: true },
    });
    assert(svUser?.studentProfile);

    const department = await prisma.department.findFirst();
    assert(department);

    // Create an isolated semester for this test
    const timestamp = Date.now();
    const semester = await prisma.semester.create({
      data: {
        code: `SEM_DEF_${timestamp}`,
        name: `Học kỳ Thử nghiệm Bảo vệ ${timestamp}`,
        academicYear: '2026-2027',
        status: 'OPEN',
        departmentId: department.id,
      },
    });
    console.log(` -> Created test semester: ${semester.code} (${semester.id})\n`);

    // 2. Setup 3 test groups with different statuses
    console.log('2. Setting up 3 test topics & groups...');
    const ts = timestamp.toString().slice(-6);
    // Group 1: Eligible for defense (midtermStatus: CONTINUE, status: ACTIVE)
    const topic1 = await prisma.topic.create({
      data: {
        title: `Đề tài Đủ ĐK Bảo vệ ${timestamp}`,
        ownerId: gv1User.id,
        departmentId: department.id,
        semesterId: semester.id,
        status: 'APPROVED',
      },
    });

    const svRole = await prisma.role.findUnique({ where: { code: 'SINH_VIEN' } });
    assert(svRole);
    const testStudentUser = await prisma.user.create({
      data: {
        email: `sv_test_${timestamp}@kltn.edu.vn`,
        fullName: 'Nguyễn Văn Test KLTN',
        passwordHash: await bcrypt.hash('Password@123', 10),
        roles: { create: { roleId: svRole.id } },
        studentProfile: {
          create: {
            studentCode: `SV_${ts}`,
            departmentId: department.id,
            creditsEarned: 120,
            eligible: true,
          },
        },
      },
      include: { studentProfile: true },
    });
    assert(testStudentUser.studentProfile);

    const group1 = await prisma.group.create({
      data: {
        code: `GRP_E_${ts}`,
        name: `Nhóm Đủ Điều Kiện BV ${ts}`,
        status: 'ACTIVE',
        semesterId: semester.id,
        topicId: topic1.id,
        midtermStatus: 'CONTINUE',
        members: {
          create: {
            studentId: testStudentUser.studentProfile.id,
            isLeader: true,
          },
        },
      },
    });

    // Group 2: NOT eligible for defense (midtermStatus: STOPPED)
    const topic2 = await prisma.topic.create({
      data: {
        title: `Đề tài Dừng Đề Tài ${timestamp}`,
        ownerId: gv1User.id,
        departmentId: department.id,
        semesterId: semester.id,
        status: 'APPROVED',
      },
    });

    const group2 = await prisma.group.create({
      data: {
        code: `GRP_S_${ts}`,
        name: `Nhóm Dừng Giữa Kỳ ${ts}`,
        status: 'ACTIVE',
        semesterId: semester.id,
        topicId: topic2.id,
        midtermStatus: 'STOPPED',
      },
    });

    // Group 3: NOT eligible for defense (status: CANCELLED)
    const topic3 = await prisma.topic.create({
      data: {
        title: `Đề tài Đã Hủy ${timestamp}`,
        ownerId: gv1User.id,
        departmentId: department.id,
        semesterId: semester.id,
        status: 'APPROVED',
      },
    });

    const group3 = await prisma.group.create({
      data: {
        code: `GRP_C_${ts}`,
        name: `Nhóm Đã Hủy ${ts}`,
        status: 'CANCELLED',
        semesterId: semester.id,
        topicId: topic3.id,
        midtermStatus: 'CONTINUE',
      },
    });

    console.log(` -> Group 1 (Eligible): ${group1.code}`);
    console.log(` -> Group 2 (Stopped): ${group2.code}`);
    console.log(` -> Group 3 (Cancelled): ${group3.code}\n`);

    // -------------------------------------------------------------
    // Test Part 1: GET /groups?readyForDefense=true
    // -------------------------------------------------------------
    console.log('3. Testing GET /groups?readyForDefense=true...');
    const readyDefenseRes = await fetch(
      `${baseUrl}/groups?semesterId=${semester.id}&readyForDefense=true`,
      {
        headers: { Authorization: `Bearer ${headToken}` },
      },
    );
    const readyDefenseJson = await readyDefenseRes.json();
    assert.equal(readyDefenseRes.status, 200);

    const eligibleGroups = readyDefenseJson.data;
    assert.equal(Array.isArray(eligibleGroups), true);
    assert.equal(eligibleGroups.length, 1, 'Only Group 1 must be returned');
    assert.equal(eligibleGroups[0].id, group1.id);
    assert.equal(eligibleGroups[0].isReadyForDefense, true);
    assert.equal(eligibleGroups[0].defenseEligibility.eligible, true);
    assert.ok(eligibleGroups[0].defenseEligibility.reason.includes('Đủ điều kiện bảo vệ'));
    console.log(' -> GET /groups?readyForDefense=true correctly filtered only eligible groups.\n');

    // Test GET /groups?readyForDefense=false
    console.log('4. Testing GET /groups?readyForDefense=false...');
    const notReadyDefenseRes = await fetch(
      `${baseUrl}/groups?semesterId=${semester.id}&readyForDefense=false`,
      {
        headers: { Authorization: `Bearer ${headToken}` },
      },
    );
    const notReadyDefenseJson = await notReadyDefenseRes.json();
    assert.equal(notReadyDefenseRes.status, 200);
    const notEligibleGroups = notReadyDefenseJson.data;
    assert.equal(notEligibleGroups.length, 2, 'Group 2 and Group 3 must be returned');
    const notEligibleIds = notEligibleGroups.map((g: any) => g.id);
    assert.ok(notEligibleIds.includes(group2.id));
    assert.ok(notEligibleIds.includes(group3.id));
    assert.ok(!notEligibleIds.includes(group1.id));
    console.log(' -> GET /groups?readyForDefense=false correctly returned non-eligible groups.\n');

    // -------------------------------------------------------------
    // Test Part 2: GET /scores?semesterId= (Incomplete scores warning)
    // -------------------------------------------------------------
    console.log('5. Testing GET /scores?semesterId= when scores are incomplete...');
    const initialScoresRes = await fetch(`${baseUrl}/scores?semesterId=${semester.id}`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    const initialScoresJson = await initialScoresRes.json();
    assert.equal(initialScoresRes.status, 200);
    assert.ok(initialScoresJson.data.summary);
    assert.equal(initialScoresJson.data.summary.totalGroups, 3);
    assert.equal(initialScoresJson.data.summary.completeScoresCount, 0);
    assert.equal(initialScoresJson.data.summary.incompleteScoresCount, 3);
    assert.equal(initialScoresJson.data.summary.hasWarning, true);

    const grp1ScoreInfo = initialScoresJson.data.items.find((it: any) => it.group.id === group1.id);
    assert.ok(grp1ScoreInfo);
    assert.equal(grp1ScoreInfo.scoreCompleteness.isComplete, false);
    assert.equal(grp1ScoreInfo.scoreCompleteness.hasWarning, true);
    assert.ok(grp1ScoreInfo.scoreCompleteness.missingComponents.includes('THIEU_DIEM_GVHD'));
    assert.ok(grp1ScoreInfo.scoreCompleteness.missingComponents.includes('CHUA_PHAN_CONG_GVPB'));
    assert.ok(grp1ScoreInfo.scoreCompleteness.missingComponents.includes('CHUA_XEP_LICH_HOI_DONG'));
    console.log(' -> Initial warnings detected correctly:');
    grp1ScoreInfo.scoreCompleteness.warnings.forEach((w: string) => console.log(`    ⚠️  ${w}`));
    console.log();

    // -------------------------------------------------------------
    // Test Part 3: Assign Reviewer & Defense Committee & Draft Scores
    // -------------------------------------------------------------
    console.log('6. Assigning GVPB and Scheduling Defense Committee for Group 1...');
    // Assign GV2 as Reviewer
    const assignRevRes = await fetch(`${baseUrl}/defense/reviewers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: group1.id,
        lecturerId: gv2User.lecturerProfile.id,
        type: 'PRIMARY',
      }),
    });
    assert.equal(assignRevRes.status, 201);

    // Create Committee and Schedule Defense
    const committee = await prisma.defenseCommittee.create({
      data: {
        name: `Hội đồng Chấm KLTN 1 - ${timestamp}`,
        departmentId: department.id,
        members: {
          create: [
            { userId: tbmUser.id, role: 'CHỦ TỊCH' },
          ],
        },
      },
    });

    const now = new Date();
    const defenseSchedule = await prisma.defenseSchedule.create({
      data: {
        groupId: group1.id,
        semesterId: semester.id,
        committeeId: committee.id,
        room: 'P. Hội thảo A',
        startsAt: new Date(now.getTime() + 24 * 3600 * 1000),
        endsAt: new Date(now.getTime() + 25 * 3600 * 1000),
        status: 'SCHEDULED',
      },
    });
    console.log(` -> Assigned GVPB and scheduled defense committee: ${committee.name}\n`);

    // GV1 inputs partial draft scores (e.g. 5/10 criteria with isDraft = true)
    console.log('7. GV1 inputs partial draft score (isDraft = true)...');
    const criteriaRes = await fetch(`${baseUrl}/scores/criteria`, {
      headers: { Authorization: `Bearer ${gv1Token}` },
    });
    const criteriaJson = await criteriaRes.json();
    const criteriaList = criteriaJson.data;
    const tcList = criteriaList.filter((c: any) => c.code.startsWith('TC'));

    const draftBatchRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gv1Token}`,
      },
      body: JSON.stringify({
        topicId: topic1.id,
        role: 'HUONG_DAN',
        isDraft: true,
        scores: [
          { tieuChiId: tcList[0].code, score: 9.0, note: 'Tốt' },
          { tieuChiId: tcList[1].code, score: 8.5, note: 'Khá' },
          { tieuChiId: tcList[2].code, score: 9.0, note: 'Tốt' },
        ],
      }),
    });
    assert.equal(draftBatchRes.status, 201);

    // Check GET /scores detects draft and incomplete criteria (< 10)
    const checkDraftScoresRes = await fetch(
      `${baseUrl}/scores?semesterId=${semester.id}&groupId=${group1.id}`,
      {
        headers: { Authorization: `Bearer ${headToken}` },
      },
    );
    const checkDraftJson = await checkDraftScoresRes.json();
    const grp1DraftInfo = checkDraftJson.data.items[0];
    assert.equal(grp1DraftInfo.scoreCompleteness.isComplete, false);
    assert.ok(grp1DraftInfo.scoreCompleteness.missingComponents.includes('GVHD_CHUA_DU_10_TIEU_CHI'));
    assert.ok(grp1DraftInfo.scoreCompleteness.missingComponents.includes('GVHD_DIEM_NHAP'));
    console.log(' -> Correctly warned on draft scores and criteria < 10:');
    grp1DraftInfo.scoreCompleteness.warnings.forEach((w: string) => console.log(`    ⚠️  ${w}`));
    console.log();

    // -------------------------------------------------------------
    // Test Part 4: Finalize all scores & add NCKH bonus points
    // -------------------------------------------------------------
    console.log('8. Finalizing scores: GVHD (9.0), GVPB (8.0), Council (8.5) and NCKH bonus (+0.5)...');
    assert.equal(tcList.length, 10, 'Must have 10 TC criteria');

    // 1. GVHD finalizes 10/10 criteria with 9.0
    const finalizeGvhdRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gv1Token}`,
      },
      body: JSON.stringify({
        topicId: topic1.id,
        role: 'HUONG_DAN',
        isDraft: false,
        scores: tcList.map((c: any) => ({
          tieuChiId: c.code,
          score: 9.0,
          note: `GVHD chấm ${c.code}`,
        })),
      }),
    });
    assert.equal(finalizeGvhdRes.status, 201);

    // 2. GVPB finalizes 10/10 criteria with 8.0
    const finalizeGvpbRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gv2Token}`,
      },
      body: JSON.stringify({
        topicId: topic1.id,
        role: 'PHAN_BIEN',
        isDraft: false,
        scores: tcList.map((c: any) => ({
          tieuChiId: c.code,
          score: 8.0,
          note: `GVPB chấm ${c.code}`,
        })),
      }),
    });
    assert.equal(finalizeGvpbRes.status, 201);

    // 3. Council Chairman (TBM) finalizes 10/10 criteria with 8.5
    const finalizeCouncilRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        topicId: topic1.id,
        role: 'HOI_DONG',
        isDraft: false,
        scores: tcList.map((c: any) => ({
          tieuChiId: c.code,
          score: 8.5,
          note: `Hội đồng chấm ${c.code}`,
        })),
      }),
    });
    assert.equal(finalizeCouncilRes.status, 201);

    // 4. Create approved NCKH evidence (+0.5 pts)
    await prisma.evidence.create({
      data: {
        userId: testStudentUser.id,
        title: 'Bài báo IEEE NCKH về AI',
        points: 0.5,
        status: 'APPROVED',
        reviewedBy: tbmUser.id,
      },
    });

    console.log(' -> All grading parties have completed their evaluations.\n');

    // -------------------------------------------------------------
    // Test Part 5: Verify GET /scores with complete score calculations
    // -------------------------------------------------------------
    console.log('9. Testing GET /scores?semesterId= with completed scores...');
    const finalScoresRes = await fetch(
      `${baseUrl}/scores?semesterId=${semester.id}&groupId=${group1.id}`,
      {
        headers: { Authorization: `Bearer ${headToken}` },
      },
    );
    const finalScoresJson = await finalScoresRes.json();
    assert.equal(finalScoresRes.status, 200);

    const grp1Complete = finalScoresJson.data.items[0];
    console.log('grp1Complete scoreCompleteness:', JSON.stringify(grp1Complete.scoreCompleteness, null, 2));
    assert.equal(grp1Complete.scoreCompleteness.isComplete, true, 'isComplete must be true when all parts done');
    assert.equal(grp1Complete.scoreCompleteness.hasWarning, false, 'hasWarning must be false');
    assert.equal(grp1Complete.scoreCompleteness.warnings.length, 0);

    // Check component scores
    assert.equal(grp1Complete.componentScores.gvhd.total, 9.0, 'GVHD total must be 9.0');
    assert.equal(grp1Complete.componentScores.gvpb.total, 8.0, 'GVPB total must be 8.0');
    assert.equal(grp1Complete.componentScores.council.total, 8.5, 'Council total must be 8.5');
    assert.equal(grp1Complete.componentScores.bonusPoints, 0.5, 'Bonus points must be 0.5');

    // Expected final score: (9.0 * 0.3 + 8.0 * 0.3 + 8.5 * 0.4) + 0.5 = 2.7 + 2.4 + 3.4 + 0.5 = 9.0
    assert.equal(grp1Complete.finalScore, 9.0, 'Final score must equal 9.0');
    assert.equal(grp1Complete.rating, 'Xuất sắc', 'Rating must be Xuất sắc');
    assert.equal(grp1Complete.result, 'DAT', 'Result must be DAT');
    console.log(` -> Group 1 Final Score: ${grp1Complete.finalScore}/10 (${grp1Complete.rating}) - ${grp1Complete.result}`);
    console.log(` -> Formula applied: "${grp1Complete.formula}"\n`);

    // -------------------------------------------------------------
    // Test Part 6: Test filter incompleteOnly=true
    // -------------------------------------------------------------
    console.log('10. Testing GET /scores with incompleteOnly=true...');
    const incompleteOnlyRes = await fetch(
      `${baseUrl}/scores?semesterId=${semester.id}&incompleteOnly=true`,
      {
        headers: { Authorization: `Bearer ${headToken}` },
      },
    );
    const incompleteOnlyJson = await incompleteOnlyRes.json();
    assert.equal(incompleteOnlyRes.status, 200);

    const filteredItems = incompleteOnlyJson.data.items;
    assert.equal(filteredItems.length, 2, 'Must only return incomplete groups (Group 2 and Group 3)');
    const filteredIds = filteredItems.map((it: any) => it.group.id);
    assert.ok(!filteredIds.includes(group1.id), 'Complete Group 1 must be excluded');
    assert.ok(filteredIds.includes(group2.id));
    assert.ok(filteredIds.includes(group3.id));
    console.log(' -> Filter incompleteOnly=true verified successfully.\n');

    // Cleanup
    console.log('11. Cleaning up test data...');
    await prisma.score.deleteMany({ where: { groupId: group1.id } });
    await prisma.defenseSchedule.deleteMany({ where: { semesterId: semester.id } });
    await prisma.defenseCommitteeMember.deleteMany({ where: { committeeId: committee.id } });
    await prisma.defenseCommittee.deleteMany({ where: { id: committee.id } });
    await prisma.reviewerAssignment.deleteMany({ where: { groupId: group1.id } });
    await prisma.groupMember.deleteMany({ where: { groupId: { in: [group1.id, group2.id, group3.id] } } });
    await prisma.group.deleteMany({ where: { id: { in: [group1.id, group2.id, group3.id] } } });
    await prisma.topic.deleteMany({ where: { id: { in: [topic1.id, topic2.id, topic3.id] } } });
    await prisma.evidence.deleteMany({ where: { userId: testStudentUser.id } });
    await prisma.studentProfile.deleteMany({ where: { userId: testStudentUser.id } });
    await prisma.userRole.deleteMany({ where: { userId: testStudentUser.id } });
    await prisma.user.deleteMany({ where: { id: testStudentUser.id } });
    await prisma.semester.deleteMany({ where: { id: semester.id } });

    console.log('========================================================================');
    console.log('ALL DEFENSE ELIGIBILITY & SCORES MANAGEMENT TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('========================================================================\n');
  } finally {
    await app.close();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST SUITE FAILED:', err);
    process.exit(1);
  });
