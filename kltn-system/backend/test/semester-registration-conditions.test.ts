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

  console.log(`Starting Registration Conditions Integration Test on port ${port}...`);

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

  // Active semester
  const activeSemester = await prisma.semester.findFirst({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(activeSemester, 'Active semester must exist');

  // Ensure registration is currently OPEN
  await prisma.semester.update({
    where: { id: activeSemester.id },
    data: {
      registrationFrom: new Date(Date.now() - 1000 * 60 * 60 * 24),
      registrationTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  // Approved topic
  const testTopic = await prisma.topic.findFirst({
    where: {
      semesterId: activeSemester.id,
      status: 'APPROVED',
      capacity: { gt: 1 },
    },
  });
  assert.ok(testTopic, 'Approved topic must exist for registration test');

  // Role map
  const svRole = await prisma.role.findUnique({ where: { code: RoleCode.SINH_VIEN } });
  assert.ok(svRole);

  const passwordHash = await bcrypt.hash('Password@123', 10);
  const testEmail = 'test_cond_sv@kltn.edu.vn';

  // Cleanup old test user if exists
  await prisma.registration.deleteMany({
    where: { student: { user: { email: testEmail } } },
  });
  await prisma.studentProfile.deleteMany({
    where: { user: { email: testEmail } },
  });
  await prisma.userRole.deleteMany({
    where: { user: { email: testEmail } },
  });
  await prisma.user.deleteMany({
    where: { email: testEmail },
  });

  // Create dedicated fresh test student
  const testUser = await prisma.user.create({
    data: {
      email: testEmail,
      fullName: 'Sinh Viên Test Điều Kiện KLTN',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });
  await prisma.userRole.create({
    data: {
      userId: testUser.id,
      roleId: svRole.id,
    },
  });
  let testStudentProfile = await prisma.studentProfile.create({
    data: {
      userId: testUser.id,
      studentCode: 'SV_TEST_COND_01',
      className: 'CNTT_K2026',
      cohort: 2026,
      departmentId: activeSemester.departmentId,
      creditsEarned: 125,
      gpa: 3.45,
      eligible: true,
      contactInfo: null,
    },
  });

  try {
    const svToken = await login(testEmail);
    const tbmToken = await login('truongbomon@kltn.edu.vn');

    console.log('1. Testing RBAC on PUT /semesters/:id/registration-conditions...');
    // Sinh viên -> 403
    const svPutRes = await fetch(
      `${baseUrl}/semesters/${activeSemester.id}/registration-conditions`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${svToken}`,
        },
        body: JSON.stringify({ minCredits: 120 }),
      },
    );
    assert.equal(svPutRes.status, 403, 'Sinh vien must not be allowed to configure conditions');

    // Trưởng bộ môn -> 200
    const tbmPutRes = await fetch(
      `${baseUrl}/semesters/${activeSemester.id}/registration-conditions`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tbmToken}`,
        },
        body: JSON.stringify({
          soTinChiToiThieu: 120,
          diemTBToiThieu: 2.5,
          monTienQuyet: ['INT3306', 'INT3307'],
          yeuCauDuDieuKien: true,
        }),
      },
    );
    assert.equal(tbmPutRes.status, 200, 'TBM must be allowed to configure conditions');
    const tbmPutJson = await tbmPutRes.json();
    assert.equal(tbmPutJson.data.soTinChiToiThieu, 120);
    assert.equal(tbmPutJson.data.diemTBToiThieu, 2.5);
    assert.deepEqual(tbmPutJson.data.monTienQuyet, ['INT3306', 'INT3307']);
    console.log(' -> RBAC & PUT verified: Conditions updated successfully with Vietnamese fields.');

    console.log('2. Testing GET /semesters/:id/registration-conditions...');
    const getCondRes = await fetch(
      `${baseUrl}/semesters/${activeSemester.id}/registration-conditions`,
      { headers: { Authorization: `Bearer ${svToken}` } },
    );
    assert.equal(getCondRes.status, 200);
    const getCondJson = await getCondRes.json();
    assert.equal(getCondJson.data.soTinChiToiThieu, 120);
    assert.equal(getCondJson.data.diemTBToiThieu, 2.5);
    console.log(' -> GET /semesters/:id/registration-conditions verified.');

    console.log('3. Testing Condition: Minimum Credits (Số tín chỉ tối thiểu)...');
    // Set minCredits to 130 (Test student has 125 credits)
    await fetch(`${baseUrl}/semesters/${activeSemester.id}/registration-conditions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tbmToken}`,
      },
      body: JSON.stringify({ minCredits: 130 }),
    });

    const svRegCreditsFailRes = await fetch(`${baseUrl}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        topicId: testTopic.id,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(svRegCreditsFailRes.status, 403, 'Student with 125 credits must be blocked when minCredits=130');
    const creditsFailJson = await svRegCreditsFailRes.json();
    assert.ok(
      creditsFailJson.error?.message?.includes('130') ||
        creditsFailJson.message?.includes('130') ||
        creditsFailJson.error?.message?.includes('tín chỉ') ||
        creditsFailJson.message?.includes('tín chỉ'),
      `Message must mention credits requirement: ${JSON.stringify(creditsFailJson)}`,
    );
    console.log(' -> Minimum credits condition check verified (blocked when credits < minCredits).');

    console.log('4. Testing Condition: Minimum GPA (Điểm trung bình tích lũy)...');
    // Set minCredits=120, minGpa=3.50 (Test student has GPA 3.45)
    await fetch(`${baseUrl}/semesters/${activeSemester.id}/registration-conditions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tbmToken}`,
      },
      body: JSON.stringify({ minCredits: 120, minGpa: 3.5 }),
    });

    const gpaFailRes = await fetch(`${baseUrl}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        topicId: testTopic.id,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(gpaFailRes.status, 403, 'Student with GPA 3.45 must be blocked when minGpa=3.5');
    const gpaFailJson = await gpaFailRes.json();
    assert.ok(
      gpaFailJson.error?.message?.includes('GPA') ||
        gpaFailJson.message?.includes('GPA') ||
        gpaFailJson.error?.message?.includes('Điểm trung bình') ||
        gpaFailJson.message?.includes('Điểm trung bình'),
      `Message must mention GPA: ${JSON.stringify(gpaFailJson)}`,
    );
    console.log(' -> Minimum GPA condition check verified (blocked when GPA < minGpa).');

    console.log('5. Testing Condition: Prerequisite Courses (Môn tiên quyết)...');
    // Set minCredits=120, minGpa=3.0, prerequisiteCourses=['INT3306', 'INT3307']
    await fetch(`${baseUrl}/semesters/${activeSemester.id}/registration-conditions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tbmToken}`,
      },
      body: JSON.stringify({
        minCredits: 120,
        minGpa: 3.0,
        prerequisiteCourses: ['INT3306', 'INT3307'],
      }),
    });

    const prereqFailRes = await fetch(`${baseUrl}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        topicId: testTopic.id,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(prereqFailRes.status, 403, 'Student missing prerequisite courses must be blocked');
    const prereqFailJson = await prereqFailRes.json();
    assert.ok(
      prereqFailJson.error?.message?.includes('môn học tiên quyết') ||
        prereqFailJson.message?.includes('môn học tiên quyết') ||
        prereqFailJson.error?.message?.includes('INT3306') ||
        prereqFailJson.message?.includes('INT3306'),
      `Message must mention missing prerequisites: ${JSON.stringify(prereqFailJson)}`,
    );

    // Update student profile with completed prerequisite courses
    await prisma.studentProfile.update({
      where: { id: testStudentProfile.id },
      data: { contactInfo: 'INT3306, INT3307' },
    });
    console.log(' -> Prerequisite courses check verified (blocked when courses missing).');

    console.log('6. Testing Condition: Eligibility Flag (Trạng thái đủ điều kiện)...');
    // Set eligible = false
    await prisma.studentProfile.update({
      where: { id: testStudentProfile.id },
      data: { eligible: false },
    });

    const eligFailRes = await fetch(`${baseUrl}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        topicId: testTopic.id,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(eligFailRes.status, 403, 'Ineligible student must be blocked');
    const eligFailJson = await eligFailRes.json();
    assert.ok(
      eligFailJson.error?.message?.includes('đủ điều kiện') ||
        eligFailJson.message?.includes('đủ điều kiện'),
      `Message must mention eligible flag: ${JSON.stringify(eligFailJson)}`,
    );

    // Restore eligible = true
    await prisma.studentProfile.update({
      where: { id: testStudentProfile.id },
      data: { eligible: true },
    });
    console.log(' -> Eligibility flag condition verified.');

    console.log('7. Testing Successful Registration when ALL conditions are met...');
    const regSuccessRes = await fetch(`${baseUrl}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        topicId: testTopic.id,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(
      regSuccessRes.status,
      201,
      `Registration should succeed when all conditions are met: ${await regSuccessRes.text()}`,
    );
    console.log(' -> Registration succeeded when SV meets all dynamic conditions (201 Created).');

    console.log('\nALL REGISTRATION CONDITIONS TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    // Cleanup created registration and test user
    await prisma.registration.deleteMany({
      where: { student: { user: { email: testEmail } } },
    });
    await prisma.studentProfile.deleteMany({
      where: { user: { email: testEmail } },
    });
    await prisma.userRole.deleteMany({
      where: { user: { email: testEmail } },
    });
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });

    // Cleanup systemConfig condition
    await prisma.systemConfig.deleteMany({
      where: { key: 'REGISTRATION_CONDITIONS', semesterId: activeSemester.id },
    });

    await app.close();
  }
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

