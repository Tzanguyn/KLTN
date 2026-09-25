import 'reflect-metadata';
import 'dotenv/config';
import { strict as assert } from 'assert';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

async function run() {
  console.log('=== TEST SUITE: 10-CRITERIA SCORING & EXPORT PDF & SCORE LOCKS ===\n');

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
    // 1. Setup users: GV (Lecturer), HOD (Trưởng BM), SV (Student)
    console.log('1. Setting up test users and roles...');
    const gvRole = await prisma.role.findUnique({ where: { code: 'GIANG_VIEN' } });
    const hodRole = await prisma.role.findUnique({ where: { code: 'TRUONG_BO_MON' } });
    const svRole = await prisma.role.findUnique({ where: { code: 'SINH_VIEN' } });

    assert(gvRole && hodRole && svRole, 'Roles must exist in DB');

    const timestamp = Date.now();
    const gvEmail = `gv_score_${timestamp}@kltn.edu.vn`;
    const hodEmail = `hod_score_${timestamp}@kltn.edu.vn`;
    const svEmail = `sv_score_${timestamp}@kltn.edu.vn`;

    const dept = await prisma.department.findFirst();
    assert(dept, 'Department must exist');
    const sem = await prisma.semester.findFirst({ where: { status: 'OPEN' } }) || await prisma.semester.findFirst();
    assert(sem, 'Semester must exist');

    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash('Password123!', 10);

    // Create GV
    const gvUser = await prisma.user.create({
      data: {
        email: gvEmail,
        fullName: 'TS. Nguyễn Văn Chấm Điểm',
        passwordHash: hashed,
        roles: { create: { roleId: gvRole.id } },
        lecturerProfile: {
          create: {
            lecturerCode: `GV_SC_${timestamp}`,
            departmentId: dept.id,
          },
        },
      },
    });

    // Create HOD
    const hodUser = await prisma.user.create({
      data: {
        email: hodEmail,
        fullName: 'PGS. TS. Trần Trưởng Bộ Môn',
        passwordHash: hashed,
        roles: { create: { roleId: hodRole.id } },
        lecturerProfile: {
          create: {
            lecturerCode: `HOD_SC_${timestamp}`,
            departmentId: dept.id,
          },
        },
      },
    });

    // Create SV
    const svUser = await prisma.user.create({
      data: {
        email: svEmail,
        fullName: 'Lê Sinh Viên Khóa Luận',
        passwordHash: hashed,
        roles: { create: { roleId: svRole.id } },
        studentProfile: {
          create: {
            studentCode: `SV_SC_${timestamp}`,
            departmentId: dept.id,
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

    const gvToken = await login(gvEmail);
    const hodToken = await login(hodEmail);
    const svToken = await login(svEmail);

    console.log(' -> GV, HOD, and SV successfully authenticated.\n');

    // 2. Setup Topic and Group
    console.log('2. Setting up Topic and Group for scoring...');
    const topic = await prisma.topic.create({
      data: {
        title: `Nghiên cứu ứng dụng Blockchain và AI trong Quản lý Chuỗi cung ứng ${timestamp}`,
        summary: 'Xây dựng giải pháp truy xuất nguồn gốc nông sản thông minh.',
        ownerId: gvUser.id,
        departmentId: dept.id,
        semesterId: sem.id,
        status: 'APPROVED',
      },
    });

    const group = await prisma.group.create({
      data: {
        code: `GRP_SC_${timestamp}`,
        name: `Nhóm Khóa luận ${timestamp}`,
        topicId: topic.id,
        semesterId: sem.id,
        status: 'ACTIVE',
        members: {
          create: {
            studentId: svUser.studentProfile!.id,
            isLeader: true,
          },
        },
      },
    });
    console.log(` -> Topic ID: ${topic.id}, Group ID: ${group.id}\n`);

    // 3. Test Criteria Seeding (10 Criteria, total weight = 100%)
    console.log('3. Testing Score Criteria (10 Criteria and total weight = 100%)...');
    const critRes = await fetch(`${baseUrl}/scores/criteria`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const critData = await critRes.json();
    assert.equal(critRes.status, 200);
    assert(Array.isArray(critData.data), 'Criteria must be an array');
    
    // Check 10 criteria TC01 to TC10
    const tcList = critData.data.filter((c: any) => c.code.startsWith('TC'));
    assert.equal(tcList.length, 10, 'Must have exactly 10 criteria starting with TC');
    const totalWeight = tcList.reduce((sum: number, c: any) => sum + Number(c.weight), 0);
    assert.equal(totalWeight, 100, 'Sum of 10 criteria weights must equal 100%');
    console.log(` -> Verified 10 criteria (TC01 - TC10) with total weight = ${totalWeight}%.\n`);

    // 4. Test GET /scoring-forms/:topicId
    console.log('4. Testing GET /scoring-forms/:topicId and GET /scores/scoring-forms/:topicId...');
    const formRes = await fetch(`${baseUrl}/scoring-forms/${topic.id}`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const formData = await formRes.json();
    assert.equal(formRes.status, 200);
    assert.equal(formData.data.topic.id, topic.id);
    assert.equal(formData.data.role, 'HUONG_DAN');
    assert.equal(formData.data.criteria.length >= 10, true);
    assert.equal(formData.data.isDraft, true);
    assert.equal(formData.data.isLocked, false);
    assert.equal(formData.data.canEdit, true);
    console.log(' -> GET /scoring-forms/:topicId returned valid scoring form structure.\n');

    // Also test alias route GET /scores/scoring-forms/:topicId
    const formAliasRes = await fetch(`${baseUrl}/scores/scoring-forms/${topic.id}`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    assert.equal(formAliasRes.status, 200, 'Alias route /scores/scoring-forms/:topicId must return 200');

    // 5. Test POST /scores with isDraft = true (Draft Scoring)
    console.log('5. Testing POST /scores with isDraft: true (Save Draft)...');
    // Scores for 10 criteria (all 8.0) -> Expected total = 8.0
    const draftScoresPayload = {
      topicId: topic.id,
      role: 'HUONG_DAN',
      scores: tcList.map((tc: any, index: number) => ({
        tieuChiId: tc.code, // Test using code string
        score: 8.0,
        note: `Đánh giá nháp tiêu chí ${index + 1}`,
      })),
      isDraft: true,
      generalComment: 'Bản nháp đánh giá tiến độ cuối kỳ',
    };

    const draftSaveRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify(draftScoresPayload),
    });
    const draftSaveData = await draftSaveRes.json();
    assert.equal(draftSaveRes.status, 201, `Failed saving draft scores: ${JSON.stringify(draftSaveData)}`);
    assert.equal(draftSaveData.data.isDraft, true);
    assert.equal(draftSaveData.data.isLocked, false);
    assert.equal(draftSaveData.data.totalScore, 8.0);
    assert.equal(draftSaveData.data.rating, 'Giỏi');
    console.log(` -> Draft scores saved successfully. Total score: ${draftSaveData.data.totalScore}/10 (${draftSaveData.data.rating}).\n`);

    // Verify GET form reflects draft state
    const formAfterDraftRes = await fetch(`${baseUrl}/scoring-forms/${topic.id}`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const formAfterDraftData = await formAfterDraftRes.json();
    assert.equal(formAfterDraftData.data.isDraft, true);
    assert.equal(formAfterDraftData.data.isLocked, false);
    assert.equal(formAfterDraftData.data.canEdit, true);
    assert.equal(formAfterDraftData.data.totalScore, 8.0);

    // 6. Test updating draft scores
    console.log('6. Testing updating draft scores...');
    // Update TC05 (weight 15%) from 8.0 to 10.0 -> total should increase by (10 - 8) * 0.15 = +0.3 => 8.3
    const updatedDraftPayload = {
      topicId: topic.id,
      role: 'HUONG_DAN',
      scores: [
        { tieuChiId: 'TC05', score: 10.0, note: 'Sản phẩm hoàn thiện xuất sắc' },
      ],
      isDraft: true,
    };
    const updateRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify(updatedDraftPayload),
    });
    const updateData = await updateRes.json();
    assert.equal(updateRes.status, 201);
    console.log(' -> Draft scores updated successfully.\n');

    // 7. Test POST /scores with isDraft = false (Finalize & Lock Scores)
    console.log('7. Testing POST /scores with isDraft: false (Finalize & Lock)...');
    // Set 9.0 for all 10 criteria using tieuChiId: 1..10 (number format)
    const finalizePayload = {
      topicId: topic.id,
      role: 'HUONG_DAN',
      scores: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => ({
        tieuChiId: num, // Test using numeric index (1 to 10)
        score: 9.0,
        note: `Điểm chính thức tiêu chí ${num}`,
      })),
      isDraft: false,
      generalComment: 'Đề tài xuất sắc, bảo vệ tự tin.',
    };

    const lockRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify(finalizePayload),
    });
    const lockData = await lockRes.json();
    assert.equal(lockRes.status, 201);
    assert.equal(lockData.data.isDraft, false);
    assert.equal(lockData.data.isLocked, true);
    assert.equal(lockData.data.totalScore, 9.0);
    assert.equal(lockData.data.rating, 'Xuất sắc');
    console.log(` -> Scores successfully finalized and locked: Total score ${lockData.data.totalScore}/10 (${lockData.data.rating}).\n`);

    // Verify GET form reflects locked state
    const formAfterLockRes = await fetch(`${baseUrl}/scoring-forms/${topic.id}`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const formAfterLockData = await formAfterLockRes.json();
    assert.equal(formAfterLockData.data.isLocked, true);
    assert.equal(formAfterLockData.data.canEdit, false);
    assert.equal(formAfterLockData.data.totalScore, 9.0);

    // Verify student received notification
    const notifRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${svToken}` },
    });
    const notifData = await notifRes.json();
    const svNotifList = Array.isArray(notifData.data)
      ? notifData.data
      : notifData.data?.items || notifData.data?.data || [];
    const scoreNotif = svNotifList.find((n: any) => n.type === 'SCORE');
    assert(scoreNotif, 'Student must receive a SCORE notification after locking');
    console.log(' -> Student received SCORE notification for finalized evaluation.\n');

    // 8. Test Security: Modifying locked scores must be REJECTED with 400 Bad Request
    console.log('8. Testing Security: Modifying locked scores without unlock must fail...');
    const illegalEditRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        topicId: topic.id,
        scores: [{ tieuChiId: 'TC01', score: 5.0 }],
        isDraft: false,
      }),
    });
    assert.equal(illegalEditRes.status, 400, 'Must reject score modification when locked');
    const illegalEditData = await illegalEditRes.json();
    assert(illegalEditData.message.includes('Điểm đã được khóa') || illegalEditData.message.includes('khóa'), 'Error message must mention score is locked');
    console.log(` -> Correctly blocked unauthorized edit on locked scores: "${illegalEditData.message}".\n`);

    // 9. Test Scorer requests unlock: POST /scores/:topicId/unlock-request
    console.log('9. Testing POST /scores/:topicId/unlock-request (Request Unlock)...');
    const unlockReqRes = await fetch(`${baseUrl}/scores/${topic.id}/unlock-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify({
        reason: 'Cần cập nhật bổ sung điểm tiêu chí TC07 do nhóm đã nộp thêm bài báo khoa học được chấp nhận đăng.',
      }),
    });
    const unlockReqData = await unlockReqRes.json();
    assert.equal(unlockReqRes.status, 201);
    const requestId = unlockReqData.data.request.id;
    assert(requestId, 'Must return created request ID');
    assert.equal(unlockReqData.data.request.status, 'PENDING');
    console.log(` -> Unlock request created with ID: ${requestId}. Status: PENDING.\n`);

    // Verify HOD received notification for the unlock request
    const hodNotifRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    const hodNotifData = await hodNotifRes.json();
    const hodNotifList = Array.isArray(hodNotifData.data)
      ? hodNotifData.data
      : hodNotifData.data?.items || hodNotifData.data?.data || [];
    const hodUnlockNotif = hodNotifList.find(
      (n: any) => n.type === 'SCORE' && n.title.includes('mở khóa'),
    );
    assert(hodUnlockNotif, 'HOD must receive notification for unlock request');
    console.log(' -> HOD received notification about score unlock request.\n');

    // 10. Test HOD reviews & approves unlock: PATCH /scores/change-requests/:id
    console.log('10. Testing HOD review: PATCH /scores/change-requests/:id (Approve)...');
    const reviewRes = await fetch(`${baseUrl}/scores/change-requests/${requestId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`,
      },
      body: JSON.stringify({ approved: true }),
    });
    const reviewData = await reviewRes.json();
    assert.equal(reviewRes.status, 200);
    assert.equal(reviewData.data.status, 'APPROVED');

    // Verify scores are now OPENED and canEdit is true
    const formAfterApprovalRes = await fetch(`${baseUrl}/scoring-forms/${topic.id}`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    const formAfterApprovalData = await formAfterApprovalRes.json();
    assert.equal(formAfterApprovalData.data.canEdit, true, 'canEdit must be true after HOD approves unlock');
    console.log(' -> HOD approved unlock. Form state: canEdit is now TRUE.\n');

    // 11. Test Lecturer can now modify scores after unlock approval
    console.log('11. Testing Lecturer updating scores after unlock approval...');
    const postUnlockPayload = {
      topicId: topic.id,
      scores: [
        { tieuChiId: 'TC07', score: 10.0, note: 'Đã bổ sung minh chứng bài báo NCKH' },
      ],
      isDraft: false,
    };
    const postUnlockRes = await fetch(`${baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gvToken}`,
      },
      body: JSON.stringify(postUnlockPayload),
    });
    assert.equal(postUnlockRes.status, 201, 'Score update must succeed after approval');
    console.log(' -> Score update succeeded after approval.\n');

    // 12. Test PDF Export: GET /scores/:topicId/export-pdf
    console.log('12. Testing GET /scores/:topicId/export-pdf (Stream PDF)...');
    const pdfRes = await fetch(`${baseUrl}/scores/${topic.id}/export-pdf`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    assert.equal(pdfRes.status, 200);
    const contentType = pdfRes.headers.get('content-type');
    assert.equal(contentType, 'application/pdf', 'Content-Type must be application/pdf');
    const pdfBuffer = await pdfRes.arrayBuffer();
    assert(pdfBuffer.byteLength > 1000, `PDF size must be substantial (actual: ${pdfBuffer.byteLength} bytes)`);
    console.log(` -> PDF streamed successfully. Content-Type: ${contentType}, Size: ${pdfBuffer.byteLength} bytes.\n`);

    // Also test group PDF route GET /scores/groups/:groupId/pdf
    const groupPdfRes = await fetch(`${baseUrl}/scores/groups/${group.id}/pdf`, {
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    assert.equal(groupPdfRes.status, 200);
    assert.equal(groupPdfRes.headers.get('content-type'), 'application/pdf');
    const groupPdfBuffer = await groupPdfRes.arrayBuffer();
    assert(groupPdfBuffer.byteLength > 1000);
    console.log(` -> Group PDF streamed successfully: ${groupPdfBuffer.byteLength} bytes.\n`);

    console.log('====================================================');
    console.log('ALL 12/12 SCORING & EXPORT TESTS PASSED SUCCESSFULLY');
    console.log('====================================================\n');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
