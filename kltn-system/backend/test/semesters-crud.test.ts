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

  console.log(`Starting Semesters CRUD & Conflict Check Integration Tests on port ${port}...`);

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

  // Cleanup any old test semesters
  const testCodes = [
    'TEST-SEM-01',
    'TEST-SEM-02',
    'TEST-SEM-OVERLAP',
    'TEST-SEM-NO-OVERLAP',
    '2026-2027-KLTN-T1',
  ];
  await prisma.semester.deleteMany({
    where: {
      OR: [
        { code: { in: testCodes } },
        { name: { contains: 'Test Semesters CRUD' } },
      ],
    },
  });

  try {
    const svToken = await login('sinhvien@kltn.edu.vn');
    const gvToken = await login('giangvien@kltn.edu.vn');
    const tbmToken = await login('truongbomon@kltn.edu.vn');
    const qlToken = await login('quanly@kltn.edu.vn');

    console.log('1. Testing RBAC permissions...');
    // Sinh viên calling POST /semesters -> 403 Forbidden
    const svPostRes = await fetch(`${baseUrl}/semesters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({
        tenHocKy: 'Test Sinh Vien',
        namHoc: '2026-2027',
      }),
    });
    assert.equal(svPostRes.status, 403, 'Sinh vien must not be allowed to POST /semesters');

    // Sinh viên calling PATCH /semesters/:id -> 403
    const svPatchRes = await fetch(`${baseUrl}/semesters/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svToken}`,
      },
      body: JSON.stringify({ tenHocKy: 'Update test' }),
    });
    assert.equal(svPatchRes.status, 403, 'Sinh vien must not be allowed to PATCH /semesters');

    // Giảng viên calling POST /semesters -> 403
    const gvPostRes = await fetch(`${baseUrl}/semesters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        tenHocKy: 'Test Giang Vien',
        namHoc: '2026-2027',
      }),
    });
    assert.equal(gvPostRes.status, 403, 'Giang vien must not be allowed to POST /semesters');

    // Sinh viên calling GET /semesters -> 200 OK
    const svGetRes = await fetch(`${baseUrl}/semesters`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    assert.equal(svGetRes.status, 200, 'Sinh vien must be allowed to GET /semesters');
    console.log(' -> RBAC verified: Students & Lecturers restricted from write, can read.');

    console.log('2. Testing Validation: Start date >= End date...');
    const invalidDateRes = await fetch(`${baseUrl}/semesters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tbmToken}`,
      },
      body: JSON.stringify({
        tenHocKy: 'Test Semesters CRUD Invalid Dates',
        namHoc: '2026-2027',
        thoiGianBatDau: '2027-05-01T00:00:00.000Z',
        thoiGianKetThuc: '2027-02-01T00:00:00.000Z',
      }),
    });
    assert.equal(invalidDateRes.status, 400, 'Start date after end date must return 400');
    const invalidDateJson = await invalidDateRes.json();
    assert.ok(
      invalidDateJson.error?.message?.includes('trước thời gian kết thúc') ||
        invalidDateJson.message?.includes('trước thời gian kết thúc'),
      'Must contain error message about dates',
    );
    console.log(' -> Invalid dates rejected with 400 as expected.');

    console.log('3. Testing POST /semesters with Vietnamese payload...');
    const createRes1 = await fetch(`${baseUrl}/semesters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tbmToken}`,
      },
      body: JSON.stringify({
        tenHocKy: 'Test Semesters CRUD Đợt 1',
        namHoc: '2026-2027',
        maHocKy: 'TEST-SEM-01',
        thoiGianBatDau: '2027-02-01T00:00:00.000Z',
        thoiGianKetThuc: '2027-06-30T23:59:59.000Z',
        trangThai: 'OPEN',
      }),
    });
    const createJson1 = await createRes1.json();
    assert.equal(createRes1.status, 201, `Create semester 1 failed: ${JSON.stringify(createJson1)}`);
    const sem1 = createJson1.data;
    assert.ok(sem1.id, 'Created semester must have ID');
    assert.equal(sem1.code, 'TEST-SEM-01');
    assert.equal(sem1.name, 'Test Semesters CRUD Đợt 1');
    assert.equal(sem1.tenHocKy, 'Test Semesters CRUD Đợt 1');
    assert.equal(sem1.namHoc, '2026-2027');
    assert.equal(sem1.trangThai, 'OPEN');
    assert.ok(sem1.thoiGianBatDau, 'Must have thoiGianBatDau');
    assert.ok(sem1.thoiGianKetThuc, 'Must have thoiGianKetThuc');
    console.log(' -> POST /semesters verified with Vietnamese fields and auto-resolved aliases.');

    console.log('4. Testing Check không trùng đợt: Duplicate Code (Mã đợt)...');
    const dupCodeRes = await fetch(`${baseUrl}/semesters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tbmToken}`,
      },
      body: JSON.stringify({
        tenHocKy: 'Test Semesters CRUD Khác Tên',
        namHoc: '2027-2028',
        maHocKy: 'TEST-SEM-01', // duplicate code
        thoiGianBatDau: '2028-02-01T00:00:00.000Z',
        thoiGianKetThuc: '2028-06-30T23:59:59.000Z',
      }),
    });
    assert.equal(dupCodeRes.status, 400, 'Duplicate code must return 400');
    const dupCodeJson = await dupCodeRes.json();
    assert.ok(
      dupCodeJson.error?.message?.includes('đã tồn tại') ||
        dupCodeJson.message?.includes('đã tồn tại'),
      'Error message must indicate duplicate code',
    );
    console.log(' -> Duplicate code correctly blocked with 400.');

    console.log('5. Testing Check không trùng đợt: Duplicate Name in Academic Year...');
    const dupNameRes = await fetch(`${baseUrl}/semesters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tbmToken}`,
      },
      body: JSON.stringify({
        tenHocKy: 'Test Semesters CRUD Đợt 1', // duplicate name
        namHoc: '2026-2027', // same year
        maHocKy: 'TEST-SEM-02',
        thoiGianBatDau: '2027-07-01T00:00:00.000Z',
        thoiGianKetThuc: '2027-08-30T23:59:59.000Z',
      }),
    });
    assert.equal(dupNameRes.status, 400, 'Duplicate name in same year must return 400');
    const dupNameJson = await dupNameRes.json();
    assert.ok(
      dupNameJson.error?.message?.includes('đã tồn tại trong năm học') ||
        dupNameJson.message?.includes('đã tồn tại trong năm học'),
      'Error message must indicate duplicate name in year',
    );
    console.log(' -> Duplicate name in academic year correctly blocked with 400.');

    console.log('6. Testing Check không trùng đợt: Overlapping Date Range (Trùng khoảng thời gian)...');
    // Overlapping with sem1 [2027-02-01, 2027-06-30]
    const overlapRes = await fetch(`${baseUrl}/semesters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${qlToken}`,
      },
      body: JSON.stringify({
        tenHocKy: 'Test Semesters CRUD Overlap Đợt',
        namHoc: '2026-2027',
        maHocKy: 'TEST-SEM-OVERLAP',
        thoiGianBatDau: '2027-03-01T00:00:00.000Z', // inside sem1 range
        thoiGianKetThuc: '2027-05-01T00:00:00.000Z',
      }),
    });
    assert.equal(overlapRes.status, 400, 'Overlapping dates must return 400');
    const overlapJson = await overlapRes.json();
    assert.ok(
      overlapJson.error?.message?.includes('bị trùng với đợt') ||
        overlapJson.message?.includes('bị trùng với đợt'),
      `Error must indicate date overlap: ${JSON.stringify(overlapJson)}`,
    );
    console.log(' -> Overlapping date range correctly blocked with 400.');

    console.log('7. Creating non-overlapping semester in future...');
    const nonOverlapRes = await fetch(`${baseUrl}/semesters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${qlToken}`,
      },
      body: JSON.stringify({
        tenHocKy: 'Test Semesters CRUD Không Trùng',
        namHoc: '2027-2028',
        maHocKy: 'TEST-SEM-NO-OVERLAP',
        thoiGianBatDau: '2027-09-01T00:00:00.000Z', // after sem1 ends
        thoiGianKetThuc: '2028-01-15T23:59:59.000Z',
      }),
    });
    assert.equal(nonOverlapRes.status, 201, 'Non-overlapping semester must be created');
    const sem2 = (await nonOverlapRes.json()).data;
    console.log(' -> Non-overlapping semester created successfully.');

    console.log('8. Testing GET /semesters and GET /semesters/:id...');
    const listRes = await fetch(`${baseUrl}/semesters?q=Test Semesters CRUD`, {
      headers: { Authorization: `Bearer ${tbmToken}` },
    });
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.ok(Array.isArray(listJson.data), 'Data must be an array');
    assert.ok(listJson.data.length >= 2, 'Must return at least the 2 test semesters');

    const getDetailRes = await fetch(`${baseUrl}/semesters/${sem1.id}`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    assert.equal(getDetailRes.status, 200);
    const detailJson = await getDetailRes.json();
    assert.equal(detailJson.data.id, sem1.id);
    assert.equal(detailJson.data.tenHocKy, 'Test Semesters CRUD Đợt 1');
    console.log(' -> GET /semesters and GET /semesters/:id verified successfully.');

    console.log('9. Testing PATCH /semesters/:id...');
    // 9a. Updating self without changing dates -> should succeed (no false duplicate on self)
    const patchSelfRes = await fetch(`${baseUrl}/semesters/${sem1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tbmToken}`,
      },
      body: JSON.stringify({
        trangThai: 'CLOSED',
      }),
    });
    assert.equal(patchSelfRes.status, 200, 'Self update must succeed');
    const patchSelfJson = await patchSelfRes.json();
    assert.equal(patchSelfJson.data.status, 'CLOSED');
    assert.equal(patchSelfJson.data.trangThai, 'CLOSED');

    // 9b. Updating sem2 to overlap with sem1 -> 400
    const patchOverlapRes = await fetch(`${baseUrl}/semesters/${sem2.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tbmToken}`,
      },
      body: JSON.stringify({
        thoiGianBatDau: '2027-03-01T00:00:00.000Z',
        thoiGianKetThuc: '2027-05-01T00:00:00.000Z',
      }),
    });
    assert.equal(patchOverlapRes.status, 400, 'Patch with overlapping dates must return 400');
    console.log(' -> PATCH /semesters/:id verified: self-update succeeds, overlapping update blocked.');

    console.log('10. Testing DELETE /semesters/:id...');
    // Delete sem2 (empty semester) -> should succeed
    const deleteRes = await fetch(`${baseUrl}/semesters/${sem2.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tbmToken}` },
    });
    assert.equal(deleteRes.status, 200, 'Delete empty semester must succeed');

    // Verify it is gone
    const checkDeletedRes = await fetch(`${baseUrl}/semesters/${sem2.id}`, {
      headers: { Authorization: `Bearer ${tbmToken}` },
    });
    assert.equal(checkDeletedRes.status, 404, 'Deleted semester must return 404');

    // Clean up sem1
    const deleteSem1Res = await fetch(`${baseUrl}/semesters/${sem1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tbmToken}` },
    });
    assert.equal(deleteSem1Res.status, 200, 'Delete sem1 must succeed');
    console.log(' -> DELETE /semesters/:id verified: successfully deleted and returns 404 afterwards.');

    console.log('\nALL SEMESTERS CRUD & DUPLICATE CHECK TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    // Cleanup any lingering test records
    await prisma.semester.deleteMany({
      where: {
        OR: [
          { code: { in: testCodes } },
          { name: { contains: 'Test Semesters CRUD' } },
        ],
      },
    });
    await app.close();
  }
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
