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

  console.log(`Running review-assignments integration tests on port ${port}...`);

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
    // 1. Logins
    const headToken = await login('truongbomon@kltn.edu.vn');
    const gvToken = await login('giangvien@kltn.edu.vn');
    const svToken = await login('sinhvien@kltn.edu.vn');

    // 2. Setup test data
    console.log('2. Setting up test data in database...');
    const semester = await prisma.semester.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });
    assert(semester, 'Active semester required');

    const department = await prisma.department.findFirst();
    assert(department, 'Department required');

    // Ensure we have at least 3 lecturers
    const allLecturers = await prisma.lecturerProfile.findMany({
      include: { user: true },
      take: 4,
    });
    assert(allLecturers.length >= 3, 'At least 3 lecturers required for testing');

    const gvhd = allLecturers[0];
    const reviewer1 = allLecturers[1];
    const reviewer2 = allLecturers[2];

    // Create a qualified test group (CHO_LAM_TIEP -> midtermStatus = CONTINUE)
    const topicQualified = await prisma.topic.create({
      data: {
        title: 'Đề tài đủ điều kiện phản biện (TEST CHO_LAM_TIEP)',
        ownerId: gvhd.userId,
        departmentId: department.id,
        semesterId: semester.id,
        status: 'APPROVED',
      },
    });

    const groupQualified = await prisma.group.create({
      data: {
        code: `GRP_TEST_REV_${Date.now().toString().slice(-4)}`,
        name: 'Nhóm Test Phân Công Phản Biện',
        status: 'ACTIVE',
        semesterId: semester.id,
        topicId: topicQualified.id,
        midtermStatus: 'CONTINUE',
        midtermNote: 'Đã hoàn thành tốt giữa kỳ, CHO_LAM_TIEP',
      },
    });

    // Create an unqualified test group (STOPPED)
    const topicStopped = await prisma.topic.create({
      data: {
        title: 'Đề tài không đủ điều kiện (TEST STOPPED)',
        ownerId: gvhd.userId,
        departmentId: department.id,
        semesterId: semester.id,
        status: 'APPROVED',
      },
    });

    const groupStopped = await prisma.group.create({
      data: {
        code: `GRP_TEST_STOP_${Date.now().toString().slice(-4)}`,
        name: 'Nhóm Test Dừng Đề Tài',
        status: 'ACTIVE',
        semesterId: semester.id,
        topicId: topicStopped.id,
        midtermStatus: 'STOPPED',
      },
    });

    // TEST 1: GET /groups?readyForReview=true
    console.log('3. Testing GET /groups?readyForReview=true...');
    const groupsRes = await fetch(`${baseUrl}/groups?readyForReview=true`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(groupsRes.status, 200, 'GET /groups?readyForReview=true must return 200');
    const groupsJson = await groupsRes.json();
    const groupsList: any[] = groupsJson.data;

    // Verify all returned groups have midtermStatus == CONTINUE
    const allContinue = groupsList.every((g) => g.midtermStatus === 'CONTINUE');
    assert.ok(allContinue, 'All returned groups must have midtermStatus = CONTINUE');
    const foundQualified = groupsList.some((g) => g.id === groupQualified.id);
    assert.ok(foundQualified, 'Must include qualified group');
    const foundStopped = groupsList.some((g) => g.id === groupStopped.id);
    assert.ok(!foundStopped, 'Must NOT include stopped group');
    console.log(' -> GET /groups?readyForReview=true verified successfully.');

    // TEST 2: GET /lecturers/available-reviewers?groupId=
    console.log('4. Testing GET /lecturers/available-reviewers?groupId=...');
    const availRes = await fetch(`${baseUrl}/lecturers/available-reviewers?groupId=${groupQualified.id}`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(availRes.status, 200, 'GET /lecturers/available-reviewers must return 200');
    const availJson = await availRes.json();
    const availData = availJson.data;

    assert.equal(availData.groupId, groupQualified.id);
    assert.equal(availData.isReadyForReview, true);
    assert.equal(availData.hasEnoughReviewers, true);
    assert.ok(Array.isArray(availData.availableReviewers), 'availableReviewers must be an array');
    assert.ok(Array.isArray(availData.suggestedPairs), 'suggestedPairs must be an array');

    // Verify GVHD is excluded from availableReviewers
    const advisorInAvailable = availData.availableReviewers.some(
      (l: any) => l.id === gvhd.id || l.userId === gvhd.userId,
    );
    assert.ok(!advisorInAvailable, 'GVHD must NOT be in availableReviewers');

    // Verify GVHD is marked with reason in allReviewers
    const advisorInAll = availData.allReviewers.find((l: any) => l.id === gvhd.id);
    assert.ok(advisorInAll, 'GVHD must be present in allReviewers');
    assert.equal(advisorInAll.isAdvisor, true, 'isAdvisor must be true for GVHD');
    assert.equal(advisorInAll.isAvailable, false, 'isAvailable must be false for GVHD');

    console.log(` -> Available reviewers count: ${availData.availableReviewers.length}`);
    console.log(` -> Suggested pairs count: ${availData.suggestedPairs.length}`);
    console.log(' -> GET /lecturers/available-reviewers verified successfully.');

    // TEST 3: POST /review-assignments: Exception: Trùng GVHD -> 400
    console.log('5. Testing POST /review-assignments: Trùng GVHD must return 400...');
    const conflictRes = await fetch(`${baseUrl}/review-assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: groupQualified.id,
        reviewerIds: [gvhd.id, reviewer1.id], // gvhd is advisor!
      }),
    });
    assert.equal(conflictRes.status, 400, 'Assigning GVHD as reviewer must return 400');
    const conflictJson = await conflictRes.json();
    assert.ok(
      conflictJson.message?.includes('Trùng GVHD') || conflictJson.message?.includes('GVHD'),
      `Message must mention GVHD conflict: ${conflictJson.message}`,
    );
    console.log(' -> Trùng GVHD -> 400 verified successfully.');

    // TEST 4: POST /review-assignments: Duplicate reviewer IDs -> 400
    console.log('6. Testing POST /review-assignments: Duplicate reviewer IDs must return 400...');
    const dupRes = await fetch(`${baseUrl}/review-assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: groupQualified.id,
        reviewerIds: [reviewer1.id, reviewer1.id], // duplicate
      }),
    });
    assert.equal(dupRes.status, 400, 'Assigning duplicate reviewer IDs must return 400');
    console.log(' -> Duplicate reviewer IDs -> 400 verified successfully.');

    // TEST 5: POST /review-assignments: Group not qualified (STOPPED) -> 400
    console.log('7. Testing POST /review-assignments: Group not CHO_LAM_TIEP must return 400...');
    const unqualRes = await fetch(`${baseUrl}/review-assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: groupStopped.id,
        reviewerIds: [reviewer1.id, reviewer2.id],
      }),
    });
    assert.equal(unqualRes.status, 400, 'Assigning reviewers to STOPPED group must return 400');
    console.log(' -> Not CHO_LAM_TIEP -> 400 verified successfully.');

    // TEST 6: POST /review-assignments: Successful assignment of 2 reviewers
    console.log('8. Testing POST /review-assignments: Successful assignment of 2 GVPB...');
    const successRes = await fetch(`${baseUrl}/review-assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: groupQualified.id,
        reviewerIds: [reviewer1.id, reviewer2.id],
      }),
    });
    const successJson = await successRes.json();
    assert.ok(successRes.status === 201 || successRes.status === 200, `Must succeed with 200/201: ${JSON.stringify(successJson)}`);
    assert.equal(successJson.data.assignments.length, 2, 'Must create 2 assignments');
    assert.equal(successJson.data.assignments[0].type, 'PRIMARY');
    assert.equal(successJson.data.assignments[1].type, 'ADDITIONAL');

    // Verify in DB
    const dbAssignments = await prisma.reviewerAssignment.findMany({
      where: { groupId: groupQualified.id },
      orderBy: { assignedAt: 'asc' },
    });
    assert.equal(dbAssignments.length, 2, 'Database must have exactly 2 assignments');
    assert.equal(dbAssignments[0].lecturerId, reviewer1.id);
    assert.equal(dbAssignments[0].type, 'PRIMARY');
    assert.equal(dbAssignments[1].lecturerId, reviewer2.id);
    assert.equal(dbAssignments[1].type, 'ADDITIONAL');
    console.log(' -> Successful assignment of 2 GVPB verified in DB.');

    // TEST 7: Alias POST /defense/review-assignments
    console.log('9. Testing alias POST /defense/review-assignments...');
    const aliasRes = await fetch(`${baseUrl}/defense/review-assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headToken}`,
      },
      body: JSON.stringify({
        groupId: groupQualified.id,
        reviewerIds: [reviewer2.id, reviewer1.id], // swap order
      }),
    });
    assert.equal(aliasRes.status, 201, 'Alias endpoint must return 201');
    const aliasJson = await aliasRes.json();
    assert.equal(aliasJson.data.assignments[0].lecturerId, reviewer2.id);
    assert.equal(aliasJson.data.assignments[0].type, 'PRIMARY');
    assert.equal(aliasJson.data.assignments[1].lecturerId, reviewer1.id);
    assert.equal(aliasJson.data.assignments[1].type, 'ADDITIONAL');
    console.log(' -> Alias POST /defense/review-assignments verified successfully.');

    // Cleanup test records
    console.log('10. Cleaning up test data...');
    await prisma.reviewerAssignment.deleteMany({
      where: { groupId: { in: [groupQualified.id, groupStopped.id] } },
    });
    await prisma.group.deleteMany({
      where: { id: { in: [groupQualified.id, groupStopped.id] } },
    });
    await prisma.topic.deleteMany({
      where: { id: { in: [topicQualified.id, topicStopped.id] } },
    });

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    await app.close();
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
