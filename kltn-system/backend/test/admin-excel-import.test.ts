import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { AdminService } from '../src/modules/admin/admin.service';

async function testExcelTemplateAndImport() {
  console.log('--- Testing Admin Excel Import & Template ---');

  // Create mock prisma service
  const createdUsers: any[] = [];
  const mockPrisma: any = {
    user: {
      findUnique: async ({ where }: any) => {
        if (where.email && createdUsers.some((u) => u.email === where.email)) {
          return { id: 'existing-id', email: where.email };
        }
        return null;
      },
      create: async ({ data }: any) => {
        const u = { id: `u-${Date.now()}-${Math.random()}`, ...data };
        createdUsers.push(u);
        return u;
      },
    },
    department: {
      findFirst: async () => ({ id: 'dept-cntt-id', code: 'CNTT', name: 'Khoa CNTT' }),
      create: async ({ data }: any) => ({ id: 'dept-cntt-id', ...data }),
    },
    studentProfile: {
      findUnique: async ({ where }: any) => {
        if (where.studentCode && createdUsers.some((u) => u.studentCode === where.studentCode)) {
          return { id: 'stu-id', studentCode: where.studentCode };
        }
        return null;
      },
      create: async ({ data }: any) => data,
    },
    lecturerProfile: {
      findUnique: async () => null,
      create: async ({ data }: any) => data,
    },
    role: {
      findUnique: async ({ where }: any) => ({ id: `role-${where.code}`, code: where.code }),
    },
    userRole: {
      findFirst: async () => null,
      create: async ({ data }: any) => data,
    },
    auditLog: {
      create: async () => ({ id: 'audit-id' }),
      count: async () => 0,
    },
    $transaction: async (cb: any) => {
      return cb(mockPrisma);
    },
  };

  const adminService = new AdminService(mockPrisma);

  // 1. Test generateUserExcelTemplate
  console.log('1. Testing generateUserExcelTemplate()...');
  const { buffer, filename } = await adminService.generateUserExcelTemplate();
  assert(buffer instanceof Buffer, 'Buffer should be an instance of Buffer');
  assert(buffer.length > 0, 'Buffer should not be empty');
  assert.equal(filename, 'Mau_Nhap_Tai_Khoan.xlsx', 'Filename should be Mau_Nhap_Tai_Khoan.xlsx');

  // Verify the generated Excel can be read by ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  assert.equal(workbook.worksheets.length, 2, 'Workbook should contain 2 worksheets');
  const mainSheet = workbook.worksheets[0];
  assert.equal(mainSheet.name, 'Danh sach tai khoan', 'First sheet name should match');
  const guideSheet = workbook.worksheets[1];
  assert.equal(guideSheet.name, 'Huong dan nhap lieu', 'Second sheet name should match');

  // Check header row in main sheet
  const headerRow = mainSheet.getRow(1);
  assert(headerRow.getCell(2).value?.toString().includes('Email'), 'Column 2 should be Email');
  assert(headerRow.getCell(3).value?.toString().includes('Họ và tên'), 'Column 3 should be Họ và tên');
  assert(headerRow.getCell(4).value?.toString().includes('Vai trò'), 'Column 4 should be Vai trò');

  console.log('   Template generated and verified successfully! ✅');

  // 2. Test importUsersFromExcel with template buffer
  console.log('2. Testing importUsersFromExcel() with sample data from template...');
  // The template has 3 sample rows (2 students, 1 lecturer)
  const mockFile: any = {
    buffer,
    originalname: filename,
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  // Mock getUserById for adminService
  (adminService as any).getUserById = async (id: string) => {
    const user = createdUsers.find((u) => u.id === id);
    return {
      ...user,
      roles: ['SINH_VIEN'],
      studentProfile: { studentCode: 'SV2026001' },
    };
  };

  const result = await adminService.importUsersFromExcel(mockFile, 'admin-123');
  console.log(`   Import result: ${result.successCount} success, ${result.failureCount} failed out of ${result.totalRows} rows`);
  assert.equal(result.totalRows, 3, 'Should process 3 sample rows');
  assert.equal(result.successCount, 3, 'All 3 sample rows should succeed');
  assert.equal(result.failureCount, 0, 'No failures expected');

  // 3. Test duplicate detection
  console.log('3. Testing duplicate detection on re-importing same users...');
  const duplicateResult = await adminService.importUsersFromExcel(mockFile, 'admin-123');
  assert.equal(duplicateResult.totalRows, 3, 'Should process 3 rows');
  assert.equal(duplicateResult.successCount, 0, 'All 3 should fail due to duplicate email');
  assert.equal(duplicateResult.failureCount, 3, 'All 3 should fail');
  assert(duplicateResult.results[0].message?.includes('tồn tại'), 'Error message should mention existing email');

  console.log('   Duplicate detection test passed! ✅');

  // 4. Test custom excel with missing email / invalid data
  console.log('4. Testing validation for empty email & invalid fields...');
  const testWb = new ExcelJS.Workbook();
  const testSheet = testWb.addWorksheet('Data');
  testSheet.addRow(['STT', 'Email (*)', 'Họ và tên (*)', 'Vai trò (*)']);
  testSheet.addRow([1, '', 'Nguyễn Không Email', 'SINH_VIEN']);
  testSheet.addRow([2, 'invalid-email-format', 'Trần Sai Email', 'SINH_VIEN']);
  testSheet.addRow([3, 'valid@kltn.edu.vn', '', 'SINH_VIEN']);
  testSheet.addRow([4, 'valid.student@kltn.edu.vn', 'Lê Hợp Lệ', 'Sinh viên']);

  const testBuf = await testWb.xlsx.writeBuffer();
  const testFile: any = {
    buffer: Buffer.from(testBuf),
    originalname: 'test_validation.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  const valResult = await adminService.importUsersFromExcel(testFile, 'admin-123');
  assert.equal(valResult.totalRows, 4, 'Total rows should be 4');
  assert.equal(valResult.failureCount, 3, '3 rows should fail validation');
  assert.equal(valResult.successCount, 1, '1 row should succeed');
  assert.equal(valResult.results[0].status, 'ERROR', 'Row 1 should be error (missing email)');
  assert.equal(valResult.results[1].status, 'ERROR', 'Row 2 should be error (invalid format)');
  assert.equal(valResult.results[2].status, 'ERROR', 'Row 3 should be error (missing name)');
  assert.equal(valResult.results[3].status, 'SUCCESS', 'Row 4 should succeed');

  console.log('   Validation test passed! ✅');

  console.log('\nAll Excel import & template tests passed with flying colors! 🚀');
}

testExcelTemplateAndImport().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
