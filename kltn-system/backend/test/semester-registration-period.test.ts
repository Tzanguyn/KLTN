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

  console.log(`Starting Registration Period Integration Test on port ${port}...`);

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

  // Find active semester
  const activeSemester = await prisma.semester.findFirst({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(activeSemester, 'Active semester must exist');

  // Save original semester registration dates
  const originalFrom = activeSemester.registrationFrom;
  const originalTo = activeSemester.registrationTo;

  // Find an approved topic to test student registration
  const approvedTopic = await prisma.topic.findFirst({
    where: {
      semesterId: activeSemester.id,
      status: 'APPROVED',
      capacity: { gt: 0 },
    },
  });
  assert.ok(approvedTopic, 'Approved topic must exist for testing registration');

  try {
    const svToken = await login('sinhvien@kltn.edu.vn');
    const gvToken = await login('giangvien@kltn.edu.vn');
    const tbmToken = await login('truongbomon@kltn.edu.vn');
    const qlToken = await login('quanly@kltn.edu.vn');

    console.log('1. Testing RBAC on PUT /semesters/:id/registration-period...');
    // Sinh viên -> 403
    const svPutRes = await fetch(`${baseUrl}/semesters/${activeSemester.id}/registration-period`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        start: new Date(Date.now() - 10000).toISOString(),
        end: new Date(Date.now() + 10000).toISOString(),
      }),
    });
    assert.equal(svPutRes.status, 403, 'Sinh vien must be blocked from configuring registration period');

    // Giảng viên -> 403
    const gvPutRes = await fetch(`${baseUrl}/semesters/${activeSemester.id}/registration-period`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        start: new Date(Date.now() - 10000).toISOString(),
        end: new Date(Date.now() + 10000).toISOString(),
      }),
    });
    assert.equal(gvPutRes.status, 403, 'Giang vien must be blocked from configuring registration period');
    console.log(' -> RBAC verified: Students and Lecturers cannot configure period (403).');

    console.log('2. Testing Validation: start >= end...');
    const invalidDateRes = await fetch(
      `${baseUrl}/semesters/${activeSemester.id}/registration-period`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tbmToken}`,
        },
        body: JSON.stringify({
          start: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // Tomorrow
          end: new Date(Date.now()).toISOString(), // Today
        }),
      },
    );
    assert.equal(invalidDateRes.status, 400, 'Start date after end date must return 400');
    const invalidDateJson = await invalidDateRes.json();
    assert.ok(
      invalidDateJson.error?.message?.includes('trước thời gian kết thúc') ||
        invalidDateJson.message?.includes('trước thời gian kết thúc'),
      'Message must explain start < end',
    );
    console.log(' -> Invalid range (start >= end) correctly rejected with 400.');

    console.log('3. Testing Configuration: Set period in FUTURE (Registration NOT yet open)...');
    const futureStart = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2); // +2 days
    const futureEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10); // +10 days

    const setFutureRes = await fetch(
      `${baseUrl}/semesters/${activeSemester.id}/registration-period`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${qlToken}`,
        },
        body: JSON.stringify({
          start: futureStart.toISOString(),
          end: futureEnd.toISOString(),
        }),
      },
    );
    assert.equal(setFutureRes.status, 200, 'Setting future registration period must succeed');
    const futureJson = await setFutureRes.json();
    assert.equal(futureJson.data.isRegistrationOpen, false);
    assert.ok(futureJson.data.registrationPeriod);

    // Verify GET /semesters/:id/registration-period
    const getPeriodRes1 = await fetch(
      `${baseUrl}/semesters/${activeSemester.id}/registration-period`,
      { headers: { Authorization: `Bearer ${svToken}` } },
    );
    assert.equal(getPeriodRes1.status, 200);
    const getPeriodJson1 = await getPeriodRes1.json();
    assert.equal(getPeriodJson1.data.isRegistrationOpen, false);

    // Test: Student registration must be BLOCKED with 403 ("Chưa đến thời gian")
    const regFutureRes = await fetch(`${baseUrl}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        topicId: approvedTopic.id,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(regFutureRes.status, 403, 'Registration before start date must return 403');
    const regFutureJson = await regFutureRes.json();
    assert.ok(
      regFutureJson.error?.message?.includes('Chưa đến thời gian') ||
        regFutureJson.message?.includes('Chưa đến thời gian'),
      `Expected "Chưa đến thời gian", got: ${JSON.stringify(regFutureJson)}`,
    );
    console.log(' -> Verified: Registration is disabled before start date (403).');

    console.log('4. Testing Configuration: Set period in PAST (Registration CLOSED/EXPIRED)...');
    const pastStart = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10); // -10 days
    const pastEnd = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2); // -2 days

    const setPastRes = await fetch(
      `${baseUrl}/semesters/${activeSemester.id}/registration-period`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tbmToken}`,
        },
        body: JSON.stringify({
          start: pastStart.toISOString(),
          end: pastEnd.toISOString(),
        }),
      },
    );
    assert.equal(setPastRes.status, 200, 'Setting past registration period must succeed');
    const pastJson = await setPastRes.json();
    assert.equal(pastJson.data.isRegistrationOpen, false);

    // Test: Student registration must be BLOCKED with 403 ("Đã hết thời gian")
    const regPastRes = await fetch(`${baseUrl}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        topicId: approvedTopic.id,
        semesterId: activeSemester.id,
      }),
    });
    assert.equal(regPastRes.status, 403, 'Registration after end date must return 403');
    const regPastJson = await regPastRes.json();
    assert.ok(
      regPastJson.error?.message?.includes('Đã hết thời gian') ||
        regPastJson.message?.includes('Đã hết thời gian'),
      `Expected "Đã hết thời gian", got: ${JSON.stringify(regPastJson)}`,
    );
    console.log(' -> Verified: Registration is disabled after end date (403).');

    console.log('5. Testing Configuration: Set period to CURRENT (Registration ENABLED)...');
    const activeStart = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2); // 2 days ago
    const activeEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days ahead

    const setActiveRes = await fetch(
      `${baseUrl}/semesters/${activeSemester.id}/registration-period`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tbmToken}`,
        },
        body: JSON.stringify({
          start: activeStart.toISOString(),
          end: activeEnd.toISOString(),
        }),
      },
    );
    assert.equal(setActiveRes.status, 200, 'Setting active period must succeed');
    const activeJson = await setActiveRes.json();
    assert.equal(activeJson.data.isRegistrationOpen, true);
    assert.equal(
      new Date(activeJson.data.registrationPeriod.start).getTime(),
      activeStart.getTime(),
    );
    assert.equal(
      new Date(activeJson.data.registrationPeriod.end).getTime(),
      activeEnd.getTime(),
    );

    const getPeriodRes2 = await fetch(
      `${baseUrl}/semesters/${activeSemester.id}/registration-period`,
      { headers: { Authorization: `Bearer ${svToken}` } },
    );
    assert.equal(getPeriodRes2.status, 200);
    const getPeriodJson2 = await getPeriodRes2.json();
    assert.equal(getPeriodJson2.data.isRegistrationOpen, true);
    console.log(' -> Verified: Registration is enabled when current time is within period.');

    console.log('\nALL REGISTRATION PERIOD TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    // Restore original semester dates
    await prisma.semester.update({
      where: { id: activeSemester.id },
      data: {
        registrationFrom: originalFrom,
        registrationTo: originalTo,
      },
    });
    await app.close();
  }
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

