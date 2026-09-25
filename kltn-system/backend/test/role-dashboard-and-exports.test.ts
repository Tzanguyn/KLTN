import 'reflect-metadata';
import 'dotenv/config';
import * as assert from 'node:assert';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

async function runTests() {
  console.log('=== TEST SUITE: ROLE-BASED DASHBOARD, WORKLOAD STATISTICS & EXPORTS ===\n');

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
    // 1. Authenticate 4 roles
    console.log('1. Logging in as 4 distinct roles...');
    const studentToken = await login('sinhvien@kltn.edu.vn');
    const lecturerToken = await login('giangvien@kltn.edu.vn');
    const headToken = await login('truongbomon@kltn.edu.vn');
    const managerToken = await login('quanly@kltn.edu.vn');
    console.log('   All 4 roles authenticated successfully.\n');

    // 2. Test GET /dashboard for SINH_VIEN
    console.log('2. Testing GET /api/dashboard for SINH_VIEN...');
    const svRes = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(svRes.status, 200, `Student dashboard failed: ${svRes.status}`);
    const svJson = await svRes.json();
    assert.equal(svJson.data.role, 'SINH_VIEN', 'Expected role to be SINH_VIEN');
    assert(svJson.data.semester, 'Expected semester info');
    assert(Array.isArray(svJson.data.actionItems), 'Expected actionItems array');
    console.log(`   Student dashboard OK. Role: ${svJson.data.role}, ActionItems: ${svJson.data.actionItems.length}\n`);

    // 3. Test GET /dashboard for GIANG_VIEN
    console.log('3. Testing GET /api/dashboard for GIANG_VIEN...');
    const gvRes = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${lecturerToken}` },
    });
    assert.equal(gvRes.status, 200, `Lecturer dashboard failed: ${gvRes.status}`);
    const gvJson = await gvRes.json();
    assert.equal(gvJson.data.role, 'GIANG_VIEN', 'Expected role to be GIANG_VIEN');
    assert(gvJson.data.summary, 'Expected lecturer summary');
    assert(typeof gvJson.data.summary.guidedGroupsCount === 'number', 'Expected guidedGroupsCount');
    assert(typeof gvJson.data.summary.maxGuidingGroups === 'number', 'Expected maxGuidingGroups');
    assert(typeof gvJson.data.summary.remainingGuidingSlots === 'number', 'Expected remainingGuidingSlots');
    assert(typeof gvJson.data.summary.isOverloaded === 'boolean', 'Expected isOverloaded');
    assert(Array.isArray(gvJson.data.guidingGroups), 'Expected guidingGroups array');
    assert(Array.isArray(gvJson.data.reviewingGroups), 'Expected reviewingGroups array');
    console.log(`   Lecturer dashboard OK. Guided: ${gvJson.data.summary.guidedGroupsCount}/${gvJson.data.summary.maxGuidingGroups}, Overloaded: ${gvJson.data.summary.isOverloaded}\n`);

    // 4. Test GET /dashboard for TRUONG_BO_MON
    console.log('4. Testing GET /api/dashboard for TRUONG_BO_MON...');
    const headRes = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(headRes.status, 200, `Head dashboard failed: ${headRes.status}`);
    const headJson = await headRes.json();
    assert.equal(headJson.data.role, 'TRUONG_BO_MON', 'Expected role to be TRUONG_BO_MON');
    assert(headJson.data.summary, 'Expected head summary');
    assert(typeof headJson.data.summary.pendingTopicsCount === 'number', 'Expected pendingTopicsCount');
    assert(typeof headJson.data.summary.unassignedReviewersCount === 'number', 'Expected unassignedReviewersCount');
    assert(typeof headJson.data.summary.incompleteScoresCount === 'number', 'Expected incompleteScoresCount');
    assert(Array.isArray(headJson.data.actionItems), 'Expected actionItems array');
    console.log(`   Head dashboard OK. PendingTopics: ${headJson.data.summary.pendingTopicsCount}, IncompleteScores: ${headJson.data.summary.incompleteScoresCount}\n`);

    // 5. Test GET /dashboard for QUAN_LY_BO_MON
    console.log('5. Testing GET /api/dashboard for QUAN_LY_BO_MON...');
    const mgrRes = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert.equal(mgrRes.status, 200, `Manager dashboard failed: ${mgrRes.status}`);
    const mgrJson = await mgrRes.json();
    assert.equal(mgrJson.data.role, 'QUAN_LY_BO_MON', 'Expected role to be QUAN_LY_BO_MON');
    assert(mgrJson.data.summary, 'Expected manager summary');
    assert(typeof mgrJson.data.summary.totalStudents === 'number', 'Expected totalStudents');
    assert(typeof mgrJson.data.summary.eligibleStudentsCount === 'number', 'Expected eligibleStudentsCount');
    assert(mgrJson.data.registrationBreakdown, 'Expected registrationBreakdown');
    console.log(`   Manager dashboard OK. TotalStudents: ${mgrJson.data.summary.totalStudents}, Eligible: ${mgrJson.data.summary.eligibleStudentsCount}\n`);

    // 6. Test GET /statistics/workload
    console.log('6. Testing GET /api/statistics/workload...');
    const wlRes = await fetch(`${baseUrl}/statistics/workload`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
    assert.equal(wlRes.status, 200, `Workload statistics failed: ${wlRes.status}`);
    const wlJson = await wlRes.json();
    assert(Array.isArray(wlJson.data), 'Expected workload data array');
    assert(wlJson.data.length > 0, 'Expected at least 1 lecturer in workload stats');
    const firstWl = wlJson.data[0];
    assert(firstWl.lecturerId, 'Expected lecturerId');
    assert(firstWl.fullName, 'Expected lecturer fullName');
    assert(typeof firstWl.guidedGroupsCount === 'number', 'Expected guidedGroupsCount');
    assert(typeof firstWl.reviewedGroupsCount === 'number', 'Expected reviewedGroupsCount');
    assert(typeof firstWl.maxGroups === 'number', 'Expected maxGroups');
    assert(typeof firstWl.isOverloaded === 'boolean', 'Expected isOverloaded');
    console.log(`   Workload stats OK. Total lecturers: ${wlJson.data.length}, Sample: ${firstWl.fullName} (Guided: ${firstWl.guidedGroupsCount}, Reviewed: ${firstWl.reviewedGroupsCount}, Max: ${firstWl.maxGroups})\n`);

    // 7. Test GET /reports/export-excel for various report types
    console.log('7. Testing GET /api/reports/export-excel (.xlsx stream)...');

    const testTypes = ['scores', 'workload', 'registrations', 'topics', 'defense-schedules'];
    for (const reportType of testTypes) {
      const excelRes = await fetch(`${baseUrl}/reports/export-excel?type=${reportType}`, {
        headers: { Authorization: `Bearer ${headToken}` },
      });
      assert.equal(excelRes.status, 200, `Excel export for type=${reportType} failed: ${excelRes.status}`);
      const contentType = excelRes.headers.get('content-type');
      assert(
        contentType?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        `Unexpected Content-Type for ${reportType}: ${contentType}`,
      );
      const arrayBuf = await excelRes.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      assert(buf.length > 100, `Excel buffer too small (${buf.length} bytes) for ${reportType}`);
      // Check zip magic bytes (PK\x03\x04)
      assert.equal(buf[0], 0x50, 'Excel magic byte 0 (P)');
      assert.equal(buf[1], 0x4b, 'Excel magic byte 1 (K)');
      console.log(`   Export Excel [${reportType}]: OK (${buf.length} bytes, valid PK zip header)`);
    }
    console.log('');

    // 8. Test GET /reports/score-sheet-pdf
    console.log('8. Testing GET /api/reports/score-sheet-pdf (PDF stream)...');

    // Find any existing group to test specific group export
    const sampleGroup = await prisma.group.findFirst({
      where: { status: { not: 'CANCELLED' } },
    });

    const pdfUrl = sampleGroup
      ? `${baseUrl}/reports/score-sheet-pdf?groupIds=${sampleGroup.id}`
      : `${baseUrl}/reports/score-sheet-pdf`;

    const pdfRes = await fetch(pdfUrl, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(pdfRes.status, 200, `Score sheet PDF export failed: ${pdfRes.status}`);
    const pdfContentType = pdfRes.headers.get('content-type');
    assert(pdfContentType?.includes('application/pdf'), `Expected application/pdf, got ${pdfContentType}`);
    const pdfArrayBuf = await pdfRes.arrayBuffer();
    const pdfBuf = Buffer.from(pdfArrayBuf);
    assert(pdfBuf.length > 500, `PDF buffer too small (${pdfBuf.length} bytes)`);
    // Check PDF magic header %PDF-
    const pdfHeader = pdfBuf.subarray(0, 5).toString('ascii');
    assert.equal(pdfHeader, '%PDF-', `Expected %PDF- magic header, got ${pdfHeader}`);
    console.log(`   Score Sheet PDF export OK: ${pdfBuf.length} bytes, valid %PDF- header.\n`);

    console.log('=== ALL ROLE DASHBOARD, WORKLOAD AND EXPORT TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    await app.close();
  }
}

runTests().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});

