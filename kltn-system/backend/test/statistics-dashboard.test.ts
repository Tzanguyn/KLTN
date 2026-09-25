import 'reflect-metadata';
import 'dotenv/config';
import * as assert from 'node:assert';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

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

  console.log(`Starting Statistics Dashboard Integration Test on port ${port}...`);

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
    const managerToken = await login('quanly@kltn.edu.vn');
    const headToken = await login('truongbomon@kltn.edu.vn');
    const studentToken = await login('sinhvien@kltn.edu.vn');

    // Get active semester
    const activeSemester = await prisma.semester.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    assert.ok(activeSemester, 'Active semester must exist');

    // Seed some test groups with various states to verify statistical categorization
    const testGroupContinue = await prisma.group.create({
      data: {
        code: `GRP_STAT_CONT_${Date.now()}`,
        name: 'Nhóm Thống Kê Tiếp Tục',
        semesterId: activeSemester.id,
        status: 'ACTIVE',
        midtermStatus: 'CONTINUE',
        midtermNote: 'Đã hoàn thành tốt tiến độ 50%',
        midtermAt: new Date(),
      },
    });

    const testGroupStopped = await prisma.group.create({
      data: {
        code: `GRP_STAT_STOP_${Date.now()}`,
        name: 'Nhóm Thống Kê Dừng',
        semesterId: activeSemester.id,
        status: 'ACTIVE',
        midtermStatus: 'STOPPED',
        midtermNote: 'Không đạt yêu cầu tối thiểu giữa kỳ',
        midtermAt: new Date(),
      },
    });

    const testGroupPending = await prisma.group.create({
      data: {
        code: `GRP_STAT_PEND_${Date.now()}`,
        name: 'Nhóm Thống Kê Chờ Đánh Giá',
        semesterId: activeSemester.id,
        status: 'FORMING',
        midtermStatus: 'PENDING',
      },
    });

    // =========================================================================
    // TEST 1: GET /statistics/registration-status
    // =========================================================================
    console.log('\n--- TEST 1: GET /statistics/registration-status ---');

    // 1.1: Without semesterId (defaults to active semester)
    const resRegDefault = await fetch(`${baseUrl}/statistics/registration-status`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert.equal(resRegDefault.status, 200, 'Default semester query must return 200');
    const jsonRegDefault = await resRegDefault.json();
    assert.ok(jsonRegDefault.data.semester, 'Must include semester information');
    assert.equal(jsonRegDefault.data.semester.id, activeSemester.id);
    assert.ok(jsonRegDefault.data.summary, 'Must include summary');
    assert.ok(typeof jsonRegDefault.data.summary.totalEligibleStudents === 'number');
    assert.ok(typeof jsonRegDefault.data.summary.registeredStudents === 'number');
    assert.ok(typeof jsonRegDefault.data.summary.unregisteredStudents === 'number');
    assert.ok(typeof jsonRegDefault.data.summary.totalGroups === 'number');
    assert.ok(jsonRegDefault.data.groups.FORMING, 'Must have groups by FORMING status');
    assert.ok(jsonRegDefault.data.groups.ACTIVE, 'Must have groups by ACTIVE status');
    assert.ok(jsonRegDefault.data.registrations, 'Must have registrations by status');
    assert.ok(Array.isArray(jsonRegDefault.data.unregisteredStudents), 'Must have unregistered students list');
    console.log(' -> 1.1 Default semester query verified successfully.');

    // 1.2: With explicit semesterId
    const resRegExplicit = await fetch(
      `${baseUrl}/statistics/registration-status?semesterId=${activeSemester.id}`,
      { headers: { Authorization: `Bearer ${managerToken}` } },
    );
    assert.equal(resRegExplicit.status, 200);
    const jsonRegExplicit = await resRegExplicit.json();
    assert.equal(jsonRegExplicit.data.semester.id, activeSemester.id);
    console.log(' -> 1.2 Explicit semesterId query verified successfully.');

    // =========================================================================
    // TEST 2: GET /statistics/progress
    // =========================================================================
    console.log('\n--- TEST 2: GET /statistics/progress ---');

    const resProg = await fetch(`${baseUrl}/statistics/progress?semesterId=${activeSemester.id}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert.equal(resProg.status, 200, 'GET /statistics/progress must return 200');
    const jsonProg = await resProg.json();
    const progData = jsonProg.data;

    assert.ok(progData.summary, 'Must include summary');
    assert.ok(typeof progData.summary.totalGroups === 'number');
    assert.ok(typeof progData.summary.completedGroupsCount === 'number');
    assert.ok(typeof progData.summary.inProgressGroupsCount === 'number');
    assert.ok(typeof progData.summary.overdueGroupsCount === 'number');
    assert.ok(typeof progData.summary.stoppedGroupsCount === 'number');
    assert.ok(typeof progData.summary.averageProgressPercent === 'number');

    assert.ok(Array.isArray(progData.groups.HOAN_THANH), 'Must have HOAN_THANH group array');
    assert.ok(Array.isArray(progData.groups.DANG_THUC_HIEN), 'Must have DANG_THUC_HIEN group array');
    assert.ok(Array.isArray(progData.groups.QUA_HAN), 'Must have QUA_HAN group array');
    assert.ok(Array.isArray(progData.groups.DUNG), 'Must have DUNG group array');

    // Verify stopped group is placed in DUNG
    const foundStopped = progData.groups.DUNG.some((g: any) => g.id === testGroupStopped.id);
    assert.ok(foundStopped, 'Stopped group must be classified under DUNG');
    console.log(' -> 2.1 Progress statistics and 4 categories verified successfully.');

    // =========================================================================
    // TEST 3: GET /statistics/milestones
    // =========================================================================
    console.log('\n--- TEST 3: GET /statistics/milestones ---');

    const resMiles = await fetch(`${baseUrl}/statistics/milestones?semesterId=${activeSemester.id}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert.equal(resMiles.status, 200, 'GET /statistics/milestones must return 200');
    const jsonMiles = await resMiles.json();
    const milesData = jsonMiles.data;

    assert.ok(Array.isArray(milesData.milestones), 'milestones must be an array');
    assert.equal(milesData.milestones.length, 5, 'Must contain exactly 5 key milestones');

    const milestoneKeys = milesData.milestones.map((m: any) => m.key);
    assert.ok(milestoneKeys.includes('MIDTERM_SUBMISSION'), 'Must include MIDTERM_SUBMISSION');
    assert.ok(milestoneKeys.includes('MIDTERM_EVALUATION'), 'Must include MIDTERM_EVALUATION');
    assert.ok(milestoneKeys.includes('FINAL_SUBMISSION'), 'Must include FINAL_SUBMISSION');
    assert.ok(milestoneKeys.includes('REVIEW'), 'Must include REVIEW');
    assert.ok(milestoneKeys.includes('DEFENSE'), 'Must include DEFENSE');

    // Verify structure of each milestone
    for (const m of milesData.milestones) {
      assert.ok(m.name, 'Milestone must have name');
      assert.ok(m.summary, 'Milestone must have summary');
      assert.ok(typeof m.summary.total === 'number');
      assert.ok(typeof m.summary.completed === 'number');
      assert.ok(typeof m.summary.inProgress === 'number');
      assert.ok(typeof m.summary.overdue === 'number');
      assert.ok(m.groups.HOAN_THANH, 'Milestone groups must have HOAN_THANH');
      assert.ok(m.groups.DANG_THUC_HIEN, 'Milestone groups must have DANG_THUC_HIEN');
      assert.ok(m.groups.QUA_HAN, 'Milestone groups must have QUA_HAN');
    }
    console.log(' -> 3.1 Five key milestones structure verified successfully.');

    // =========================================================================
    // TEST 4: GET /statistics/midterm-results
    // =========================================================================
    console.log('\n--- TEST 4: GET /statistics/midterm-results ---');

    const resMidterm = await fetch(`${baseUrl}/statistics/midterm-results?semesterId=${activeSemester.id}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert.equal(resMidterm.status, 200, 'GET /statistics/midterm-results must return 200');
    const jsonMidterm = await resMidterm.json();
    const midData = jsonMidterm.data;

    assert.ok(midData.summary, 'Must include summary');
    assert.ok(typeof midData.summary.totalGroups === 'number');
    assert.ok(typeof midData.summary.continueCount === 'number');
    assert.ok(typeof midData.summary.stoppedCount === 'number');
    assert.ok(typeof midData.summary.pendingCount === 'number');

    assert.ok(Array.isArray(midData.groupsByResult.CONTINUE), 'Must have CONTINUE groups list');
    assert.ok(Array.isArray(midData.groupsByResult.STOPPED), 'Must have STOPPED groups list');
    assert.ok(Array.isArray(midData.groupsByResult.PENDING), 'Must have PENDING groups list');

    const foundCont = midData.groupsByResult.CONTINUE.some((g: any) => g.id === testGroupContinue.id);
    assert.ok(foundCont, 'CONTINUE list must include testGroupContinue');
    const foundStop = midData.groupsByResult.STOPPED.some((g: any) => g.id === testGroupStopped.id);
    assert.ok(foundStop, 'STOPPED list must include testGroupStopped');
    const foundPend = midData.groupsByResult.PENDING.some((g: any) => g.id === testGroupPending.id);
    assert.ok(foundPend, 'PENDING list must include testGroupPending');
    console.log(' -> 4.1 Midterm results categorization (CONTINUE, STOPPED, PENDING) verified.');

    // =========================================================================
    // TEST 5: RBAC Authorization
    // =========================================================================
    console.log('\n--- TEST 5: RBAC Authorization ---');

    // 5.1: Head of Department access
    const resHead = await fetch(`${baseUrl}/statistics/registration-status`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(resHead.status, 200, 'TRUONG_BO_MON must be allowed access (200)');
    console.log(' -> 5.1 TRUONG_BO_MON access verified.');

    // 5.2: Student access forbidden
    const resStudent = await fetch(`${baseUrl}/statistics/registration-status`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resStudent.status, 403, 'SINH_VIEN must be forbidden from statistics (403)');
    console.log(' -> 5.2 SINH_VIEN 403 Forbidden verified.');

    // Clean up test groups
    await prisma.group.deleteMany({
      where: {
        id: { in: [testGroupContinue.id, testGroupStopped.id, testGroupPending.id] },
      },
    });

    console.log('\n🎉 ALL STATISTICS DASHBOARD TESTS PASSED SUCCESSFULLY! 🎉\n');
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

