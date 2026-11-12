import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ResetPasswordAdminDto,
  UpdateUserDto,
  UpdateUserStatusDto,
} from './dto/update-user.dto';
import { BatchCreateUserDto } from './dto/batch-create-user.dto';
import {
  SystemOperationalMode,
  UpdateSystemStatusDto,
} from './dto/system-status.dto';
import { UpdateModuleSwitchesDto } from './dto/module-switches.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Thống kê tổng quan dành cho Admin Dashboard
   */
  async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      lockedUsers,
      inactiveUsers,
      rolesCount,
      totalSemesters,
      activeSemesters,
      totalTopics,
      systemStatus,
      moduleSwitches,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.LOCKED } }),
      this.prisma.user.count({ where: { status: UserStatus.INACTIVE } }),
      this.prisma.userRole.groupBy({
        by: ['roleId'],
        _count: { userId: true },
      }),
      this.prisma.semester.count(),
      this.prisma.semester.count({ where: { status: 'OPEN' } }),
      this.prisma.topic.count(),
      this.getSystemStatus(),
      this.getModuleSwitches(),
    ]);

    const allRoles = await this.prisma.role.findMany();
    const roleStats: Record<string, number> = {};
    for (const r of allRoles) {
      const match = rolesCount.find((rc) => rc.roleId === r.id);
      roleStats[r.code] = match?._count.userId ?? 0;
    }

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        locked: lockedUsers,
        inactive: inactiveUsers,
        byRole: roleStats,
      },
      semesters: {
        total: totalSemesters,
        active: activeSemesters,
      },
      topics: {
        total: totalTopics,
      },
      system: {
        status: systemStatus,
        modules: moduleSwitches,
      },
      leadership: await this.getDepartmentLeadership(),
    };
  }

  /**
   * Lấy thông tin Trưởng bộ môn và Quản lý bộ môn hiện tại (duy nhất 1 mỗi vai trò)
   */
  async getDepartmentLeadership() {
    const [headRole, managerRole] = await Promise.all([
      this.prisma.role.findUnique({ where: { code: RoleCode.TRUONG_BO_MON } }),
      this.prisma.role.findUnique({ where: { code: RoleCode.QUAN_LY_BO_MON } }),
    ]);

    const [head, manager] = await Promise.all([
      headRole
        ? this.prisma.userRole.findFirst({
            where: { roleId: headRole.id },
            include: {
              user: {
                include: {
                  lecturerProfile: { include: { department: true } },
                },
              },
            },
          })
        : null,
      managerRole
        ? this.prisma.userRole.findFirst({
            where: { roleId: managerRole.id },
            include: {
              user: {
                include: {
                  lecturerProfile: { include: { department: true } },
                },
              },
            },
          })
        : null,
    ]);

    return {
      head: head?.user
        ? {
            id: head.user.id,
            fullName: head.user.fullName,
            email: head.user.email,
            lecturerCode: head.user.lecturerProfile?.lecturerCode,
            title: head.user.lecturerProfile?.title,
            department: head.user.lecturerProfile?.department?.name,
          }
        : null,
      manager: manager?.user
        ? {
            id: manager.user.id,
            fullName: manager.user.fullName,
            email: manager.user.email,
            lecturerCode: manager.user.lecturerProfile?.lecturerCode,
            title: manager.user.lecturerProfile?.title,
            department: manager.user.lecturerProfile?.department?.name,
          }
        : null,
    };
  }

  /**
   * Danh sách người dùng có tìm kiếm, lọc theo vai trò, trạng thái và phân trang
   */
  async getUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: RoleCode;
    status?: UserStatus;
  }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.role) {
      where.roles = {
        some: {
          role: {
            code: query.role,
          },
        },
      };
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
        {
          studentProfile: {
            OR: [
              { studentCode: { contains: s, mode: 'insensitive' } },
              { className: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
        {
          lecturerProfile: {
            OR: [
              { lecturerCode: { contains: s, mode: 'insensitive' } },
              { specialization: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          roles: { include: { role: true } },
          studentProfile: { include: { department: true } },
          lecturerProfile: { include: { department: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formattedItems = items.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      avatarUrl: u.avatarUrl,
      status: u.status,
      roles: u.roles.map((r) => r.role.code),
      primaryRole: u.roles[0]?.role.code ?? 'SINH_VIEN',
      identifier:
        u.studentProfile?.studentCode ||
        u.lecturerProfile?.lecturerCode ||
        u.email,
      studentProfile: u.studentProfile,
      lecturerProfile: u.lecturerProfile,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));

    return {
      items: formattedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy chi tiết một người dùng theo ID
   */
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        studentProfile: {
          include: {
            department: true,
            registrations: { include: { topic: true, semester: true }, take: 5 },
          },
        },
        lecturerProfile: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    const auditCount = await this.prisma.auditLog.count({ where: { userId: id } });

    return {
      ...user,
      roles: user.roles.map((r) => r.role.code),
      auditLogsCount: auditCount,
    };
  }

  /**
   * Tạo tài khoản mới bởi Quản trị viên
   */
  async createUser(dto: CreateUserDto, adminId?: string) {
    const email = dto.email.toLowerCase().trim();

    // 1. Kiểm tra trùng email
    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new ConflictException(`Email '${email}' đã tồn tại trong hệ thống.`);
    }

    // 2. Tìm hoặc mặc định Department
    let department = await this.prisma.department.findFirst({
      where: dto.departmentCode ? { code: dto.departmentCode } : { code: 'CNTT' },
    });
    if (!department) {
      department = await this.prisma.department.findFirst();
    }
    if (!department) {
      department = await this.prisma.department.create({
        data: {
          code: 'CNTT',
          name: 'Công nghệ thông tin',
          description: 'Khoa Công nghệ thông tin',
        },
      });
    }

    // 3. Kiểm tra mã sinh viên / giảng viên nếu có
    if (dto.role === RoleCode.SINH_VIEN && dto.studentCode) {
      const existingStudent = await this.prisma.studentProfile.findUnique({
        where: { studentCode: dto.studentCode.trim() },
      });
      if (existingStudent) {
        throw new ConflictException(`Mã sinh viên '${dto.studentCode}' đã được sử dụng.`);
      }
    }

    if (
      (dto.role === RoleCode.GIANG_VIEN || dto.role === RoleCode.TRUONG_BO_MON) &&
      dto.lecturerCode
    ) {
      const existingLecturer = await this.prisma.lecturerProfile.findUnique({
        where: { lecturerCode: dto.lecturerCode.trim() },
      });
      if (existingLecturer) {
        throw new ConflictException(`Mã giảng viên '${dto.lecturerCode}' đã được sử dụng.`);
      }
    }

    // 3.5. Kiểm tra quy chế nhân sự: Hệ thống chỉ có DUY NHẤT 1 Trưởng bộ môn và 1 Quản lý bộ môn
    if (dto.role === RoleCode.TRUONG_BO_MON) {
      const existingTBM = await this.prisma.userRole.findFirst({
        where: { role: { code: RoleCode.TRUONG_BO_MON } },
        include: { user: true },
      });
      if (existingTBM) {
        throw new BadRequestException(
          `Hệ thống chỉ cho phép duy nhất 1 Trưởng bộ môn. Hiện tại vị trí này đang do '${existingTBM.user.fullName}' (${existingTBM.user.email}) đảm nhiệm. Vui lòng chuyển đổi vai trò của nhân sự hiện tại trước khi tạo mới Trưởng bộ môn.`,
        );
      }
    }

    if (dto.role === RoleCode.QUAN_LY_BO_MON) {
      const existingQL = await this.prisma.userRole.findFirst({
        where: { role: { code: RoleCode.QUAN_LY_BO_MON } },
        include: { user: true },
      });
      if (existingQL) {
        throw new BadRequestException(
          `Hệ thống chỉ cho phép duy nhất 1 Quản lý bộ môn. Hiện tại vị trí này đang do '${existingQL.user.fullName}' (${existingQL.user.email}) đảm nhiệm. Vui lòng chuyển đổi vai trò của nhân sự hiện tại trước khi tạo mới Quản lý bộ môn.`,
        );
      }
    }

    // 4. Lấy Role record từ database
    const roleRecord = await this.prisma.role.findUnique({ where: { code: dto.role } });
    if (!roleRecord) {
      throw new BadRequestException(`Vai trò '${dto.role}' không tồn tại trong hệ thống.`);
    }

    // 5. Hash password (mặc định Password@123 nếu không truyền)
    const rawPassword = dto.password || 'Password@123';
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    // 6. Tạo User & UserRole trong transaction
    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName: dto.fullName.trim(),
          phone: dto.phone?.trim() || null,
          status: dto.status || UserStatus.ACTIVE,
          passwordHash,
        },
      });

      // Gán Role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: roleRecord.id,
        },
      });

      // Nếu là Sinh viên -> Tạo StudentProfile
      if (dto.role === RoleCode.SINH_VIEN) {
        const studentCode =
          dto.studentCode?.trim() ||
          `SV${Date.now().toString().slice(-6)}`;
        await tx.studentProfile.create({
          data: {
            userId: user.id,
            studentCode,
            className: dto.className?.trim() || 'CNTT K2026',
            cohort: dto.cohort || 2026,
            creditsEarned: dto.creditsEarned ?? 0,
            gpa: dto.gpa !== undefined ? dto.gpa : null,
            eligible: dto.eligible !== undefined ? dto.eligible : true,
            departmentId: department.id,
          },
        });
      }

      // Nếu là Giảng viên hoặc Trưởng BM -> Tạo LecturerProfile
      if (
        dto.role === RoleCode.GIANG_VIEN ||
        dto.role === RoleCode.TRUONG_BO_MON ||
        dto.role === RoleCode.QUAN_LY_BO_MON
      ) {
        const lecturerCode =
          dto.lecturerCode?.trim() ||
          `GV${Date.now().toString().slice(-4)}`;
        await tx.lecturerProfile.create({
          data: {
            userId: user.id,
            lecturerCode,
            title: dto.title?.trim() || (dto.role === RoleCode.TRUONG_BO_MON ? 'PGS. TS.' : 'ThS.'),
            specialization: dto.specialization?.trim() || 'Công nghệ phần mềm',
            maxGroups: dto.maxGroups || 5,
            departmentId: department.id,
          },
        });
      }

      return user;
    });

    // 7. Ghi Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId || null,
          action: 'ADMIN_CREATE_USER',
          entity: 'User',
          entityId: newUser.id,
          metadata: {
            email: newUser.email,
            role: dto.role,
            fullName: newUser.fullName,
          },
        },
      });
    } catch {}

    return this.getUserById(newUser.id);
  }

  /**
   * Tạo tài khoản hàng loạt (Batch create)
   */
  async batchCreateUsers(dto: BatchCreateUserDto, adminId?: string) {
    const results: Array<{
      email: string;
      fullName: string;
      role: RoleCode;
      status: 'SUCCESS' | 'ERROR';
      message?: string;
    }> = [];

    for (const item of dto.users) {
      try {
        await this.createUser(item, adminId);
        results.push({
          email: item.email,
          fullName: item.fullName,
          role: item.role,
          status: 'SUCCESS',
        });
      } catch (err: any) {
        results.push({
          email: item.email,
          fullName: item.fullName,
          role: item.role,
          status: 'ERROR',
          message: err.message || 'Lỗi tạo tài khoản',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const failureCount = results.filter((r) => r.status === 'ERROR').length;

    return {
      total: dto.users.length,
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * Trích xuất giá trị chuỗi an toàn từ một cell ExcelJS
   */
  private extractCellValue(cell: any): string {
    if (cell === null || cell === undefined) return '';
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number' || typeof val === 'boolean') return String(val).trim();
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'object') {
      if (val.text !== undefined) return String(val.text).trim();
      if (val.result !== undefined) return String(val.result).trim();
      if (Array.isArray(val.richText)) {
        return val.richText.map((t: any) => (t && t.text ? t.text : '')).join('').trim();
      }
    }
    return String(val).trim();
  }

  /**
   * Chuẩn hóa tên cột (bỏ dấu tiếng Việt, viết thường, bỏ ký tự đặc biệt)
   */
  private normalizeHeader(header: string): string {
    if (!header) return '';
    return header
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Nhận diện trường dữ liệu từ tên cột
   */
  private detectHeaderField(normalized: string): string | null {
    if (['email', 'mail', 'thudientu', 'taikhoan', 'diachiemail'].includes(normalized)) return 'email';
    if (['hovaten', 'hoten', 'fullname', 'name', 'ten', 'hovatennguoidung'].includes(normalized)) return 'fullName';
    if (['vaitro', 'role', 'chucvu', 'loaitaikhoan', 'quyen'].includes(normalized)) return 'role';
    if (['matkhau', 'password', 'pass'].includes(normalized)) return 'password';
    if (['sodienthoai', 'dienthoai', 'sdt', 'phone', 'tel', 'soct', 'lienhe'].includes(normalized)) return 'phone';
    if (['masv', 'mssv', 'masinhvien', 'studentcode'].includes(normalized)) return 'studentCode';
    if (['magv', 'msgv', 'magiangvien', 'lecturercode'].includes(normalized)) return 'lecturerCode';
    if (['masvgv', 'masocanhan', 'macanhan', 'maso', 'code', 'masvmagv'].includes(normalized)) return 'genericCode';
    if (['lophoc', 'lop', 'classname', 'malop', 'lopsinhhoat'].includes(normalized)) return 'className';
    if (['khoahoc', 'nienkhoa', 'cohort'].includes(normalized)) return 'cohort';
    if (['tinchi', 'sotinchi', 'tinchitichluy', 'creditsearned', 'credits'].includes(normalized)) return 'creditsEarned';
    if (['gpa', 'diemtb', 'diemtichluy', 'diem'].includes(normalized)) return 'gpa';
    if (['dudieukien', 'dudk', 'xetkltn', 'eligible'].includes(normalized)) return 'eligible';
    if (['hocvi', 'hocham', 'title', 'chucdanh'].includes(normalized)) return 'title';
    if (['chuyennganh', 'specialization', 'huongnghiencuu', 'bomonchuyenmon'].includes(normalized)) return 'specialization';
    if (['sonhomtoida', 'sonhom', 'maxgroups', 'sohuongdan', 'hanmucnhom'].includes(normalized)) return 'maxGroups';
    if (['bomon', 'khoa', 'mabomon', 'makhoa', 'departmentcode', 'department'].includes(normalized)) return 'departmentCode';
    return null;
  }

  /**
   * Nhận diện và ánh xạ RoleCode
   */
  private parseRole(
    rawRole: string,
    studentCode?: string,
    lecturerCode?: string,
    genericCode?: string,
  ): RoleCode {
    const norm = this.normalizeHeader(rawRole);
    if (['sinhvien', 'sv', 'student'].includes(norm) || norm.includes('sinhvien')) return RoleCode.SINH_VIEN;
    if (['giangvien', 'gv', 'lecturer', 'teacher'].includes(norm) || norm.includes('giangvien')) return RoleCode.GIANG_VIEN;
    if (['truongbomon', 'tbm', 'head'].includes(norm) || norm.includes('truong')) return RoleCode.TRUONG_BO_MON;
    if (['quanlybomon', 'qlbm', 'manager'].includes(norm) || norm.includes('quanly')) return RoleCode.QUAN_LY_BO_MON;
    if (['admin', 'quantri', 'quantrivien', 'administrator'].includes(norm)) return RoleCode.ADMIN;

    if (studentCode || (genericCode && genericCode.toUpperCase().startsWith('SV'))) {
      return RoleCode.SINH_VIEN;
    }
    if (lecturerCode || (genericCode && genericCode.toUpperCase().startsWith('GV'))) {
      return RoleCode.GIANG_VIEN;
    }

    return RoleCode.SINH_VIEN;
  }

  /**
   * Chuyển đổi giá trị sang boolean (cho trường eligible)
   */
  private parseBoolean(val: string): boolean {
    if (!val) return true;
    const norm = this.normalizeHeader(val);
    if (['co', 'true', 'yes', '1', 'dat', 'ok'].includes(norm)) return true;
    if (['khong', 'false', 'no', '0', 'chuadat', 'k'].includes(norm)) return false;
    return true;
  }

  /**
   * Tạo và xuất file Excel mẫu chuẩn hóa để Admin tải về và nhập liệu
   */
  async generateUserExcelTemplate(): Promise<{ buffer: Buffer; filename: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KLTN System Admin';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Danh sach tai khoan', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Email (*)', key: 'email', width: 30 },
      { header: 'Họ và tên (*)', key: 'fullName', width: 26 },
      { header: 'Vai trò (*)', key: 'role', width: 18 },
      { header: 'Mật khẩu', key: 'password', width: 16 },
      { header: 'Số điện thoại', key: 'phone', width: 16 },
      { header: 'Mã SV / Mã GV', key: 'genericCode', width: 18 },
      { header: 'Lớp học (SV)', key: 'className', width: 16 },
      { header: 'Khóa (SV)', key: 'cohort', width: 12 },
      { header: 'Tín chỉ tích lũy (SV)', key: 'creditsEarned', width: 22 },
      { header: 'GPA (SV)', key: 'gpa', width: 12 },
      { header: 'Đủ ĐK (SV)', key: 'eligible', width: 14 },
      { header: 'Học vị (GV)', key: 'title', width: 14 },
      { header: 'Chuyên ngành (GV)', key: 'specialization', width: 26 },
      { header: 'Số nhóm tối đa (GV)', key: 'maxGroups', width: 20 },
      { header: 'Mã bộ môn', key: 'departmentCode', width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' },
      };
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
    });

    sheet.addRow({
      stt: 1,
      email: 'sinhvien.mau1@kltn.edu.vn',
      fullName: 'Nguyễn Văn An',
      role: 'SINH_VIEN',
      password: 'Password@123',
      phone: '0901234567',
      genericCode: 'SV2026001',
      className: 'DHKTPM18A',
      cohort: 2026,
      creditsEarned: 125,
      gpa: 3.42,
      eligible: 'Có',
      title: '',
      specialization: '',
      maxGroups: '',
      departmentCode: 'CNTT',
    });

    sheet.addRow({
      stt: 2,
      email: 'sinhvien.mau2@kltn.edu.vn',
      fullName: 'Trần Thị Bình',
      role: 'SINH_VIEN',
      password: '',
      phone: '0912345678',
      genericCode: 'SV2026002',
      className: 'DHKTPM18B',
      cohort: 2026,
      creditsEarned: 118,
      gpa: 3.15,
      eligible: 'Có',
      title: '',
      specialization: '',
      maxGroups: '',
      departmentCode: 'CNTT',
    });

    sheet.addRow({
      stt: 3,
      email: 'giangvien.mau1@kltn.edu.vn',
      fullName: 'Lê Hoàng Long',
      role: 'GIANG_VIEN',
      password: '',
      phone: '0987654321',
      genericCode: 'GV0089',
      className: '',
      cohort: '',
      creditsEarned: '',
      gpa: '',
      eligible: '',
      title: 'TS.',
      specialization: 'Khoa học dữ liệu & Trí tuệ nhân tạo',
      maxGroups: 5,
      departmentCode: 'CNTT',
    });

    for (let r = 2; r <= 4; r++) {
      const row = sheet.getRow(r);
      row.height = 22;
      row.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    }

    const guideSheet = workbook.addWorksheet('Huong dan nhap lieu');
    guideSheet.columns = [
      { header: 'Tên cột', key: 'col', width: 25 },
      { header: 'Quy tắc', key: 'required', width: 14 },
      { header: 'Mô tả & Định dạng chấp nhận', key: 'desc', width: 55 },
      { header: 'Ví dụ hợp lệ', key: 'example', width: 30 },
    ];
    guideSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    guideSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    guideSheet.getRow(1).height = 28;

    const guideRows = [
      { col: 'Email (*)', required: 'Bắt buộc', desc: 'Địa chỉ email duy nhất, chưa tồn tại trong hệ thống', example: 'sv2026@kltn.edu.vn' },
      { col: 'Họ và tên (*)', required: 'Bắt buộc', desc: 'Họ và tên đầy đủ của người dùng', example: 'Nguyễn Văn An' },
      { col: 'Vai trò (*)', required: 'Bắt buộc', desc: 'SINH_VIEN | GIANG_VIEN | TRUONG_BO_MON | QUAN_LY_BO_MON | ADMIN', example: 'SINH_VIEN' },
      { col: 'Mật khẩu', required: 'Tùy chọn', desc: 'Tối thiểu 8 ký tự. Để trống mặc định là Password@123', example: 'Password@123' },
      { col: 'Số điện thoại', required: 'Tùy chọn', desc: 'Số điện thoại liên lạc', example: '0901234567' },
      { col: 'Mã SV / Mã GV', required: 'Khuyến nghị', desc: 'Mã số sinh viên hoặc mã số giảng viên (duy nhất)', example: 'SV2026001 / GV0089' },
      { col: 'Lớp học (SV)', required: 'Sinh viên', desc: 'Lớp sinh hoạt dành cho sinh viên', example: 'DHKTPM18A' },
      { col: 'Khóa (SV)', required: 'Sinh viên', desc: 'Khóa học (số nguyên)', example: '2026' },
      { col: 'Tín chỉ (SV)', required: 'Sinh viên', desc: 'Số tín chỉ đã tích lũy (số nguyên)', example: '125' },
      { col: 'GPA (SV)', required: 'Sinh viên', desc: 'Điểm trung bình tích lũy thang điểm 4 (số thập phân)', example: '3.42' },
      { col: 'Đủ ĐK (SV)', required: 'Sinh viên', desc: 'Đủ điều kiện làm KLTN (Có / Không hoặc 1 / 0)', example: 'Có' },
      { col: 'Học vị (GV)', required: 'Giảng viên', desc: 'Học hàm / học vị của giảng viên', example: 'TS., ThS., PGS.TS.' },
      { col: 'Chuyên ngành (GV)', required: 'Giảng viên', desc: 'Hướng nghiên cứu / chuyên môn giảng dạy', example: 'Kỹ thuật phần mềm' },
      { col: 'Số nhóm tối đa (GV)', required: 'Giảng viên', desc: 'Số nhóm KLTN tối đa có thể hướng dẫn (mặc định 5)', example: '5' },
      { col: 'Mã bộ môn', required: 'Tùy chọn', desc: 'Mã bộ môn quản lý (mặc định CNTT)', example: 'CNTT' },
    ];

    guideRows.forEach((r) => guideSheet.addRow(r));
    for (let r = 2; r <= guideRows.length + 1; r++) {
      guideSheet.getRow(r).height = 20;
      guideSheet.getRow(r).alignment = { vertical: 'middle' };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: 'Mau_Nhap_Tai_Khoan.xlsx',
    };
  }

  /**
   * Đọc và nhập danh sách tài khoản người dùng từ file Excel
   */
  async importUsersFromExcel(file: Express.Multer.File, adminId?: string) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Tệp tải lên không hợp lệ hoặc rỗng.');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as any);
    } catch (err: any) {
      throw new BadRequestException('Không thể đọc file Excel. Định dạng file có thể bị hỏng hoặc không đúng.');
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount <= 1) {
      throw new BadRequestException('File Excel không có dữ liệu để nhập.');
    }

    // Quét tìm dòng tiêu đề chứa cột 'email' (hỗ trợ file có dòng tiêu đề banner ở đầu)
    let headerRowIndex = -1;
    let columnMap: { [colNumber: number]: string } = {};

    for (let r = 1; r <= Math.min(worksheet.rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      let hasEmail = false;
      const tempMap: { [colNumber: number]: string } = {};

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const rawVal = this.extractCellValue(cell);
        const norm = this.normalizeHeader(rawVal);
        const field = this.detectHeaderField(norm);
        if (field) {
          tempMap[colNumber] = field;
          if (field === 'email') {
            hasEmail = true;
          }
        }
      });

      if (hasEmail) {
        headerRowIndex = r;
        columnMap = tempMap;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new BadRequestException(
        'Không tìm thấy dòng tiêu đề chứa cột "Email" trong file Excel. Vui lòng sử dụng file mẫu chuẩn của hệ thống.',
      );
    }

    const results: Array<{
      rowNumber: number;
      email: string;
      fullName: string;
      role?: RoleCode | string;
      status: 'SUCCESS' | 'ERROR';
      message?: string;
    }> = [];

    for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);

      const rowData: Record<string, string> = {};
      let hasAnyData = false;

      Object.entries(columnMap).forEach(([colNumberStr, field]) => {
        const colNumber = parseInt(colNumberStr, 10);
        const cell = row.getCell(colNumber);
        const val = this.extractCellValue(cell);
        if (val) {
          hasAnyData = true;
          rowData[field] = val;
        }
      });

      if (!hasAnyData) {
        continue;
      }

      const email = (rowData['email'] || '').trim().toLowerCase();
      const fullName = (rowData['fullName'] || '').trim();
      const rawRole = (rowData['role'] || '').trim();
      const password = (rowData['password'] || '').trim();
      const phone = (rowData['phone'] || '').trim();
      const genericCode = (rowData['genericCode'] || '').trim();
      let studentCode = (rowData['studentCode'] || '').trim();
      let lecturerCode = (rowData['lecturerCode'] || '').trim();
      const className = (rowData['className'] || '').trim();
      const cohortRaw = (rowData['cohort'] || '').trim();
      const creditsRaw = (rowData['creditsEarned'] || '').trim();
      const gpaRaw = (rowData['gpa'] || '').trim();
      const eligibleRaw = (rowData['eligible'] || '').trim();
      const title = (rowData['title'] || '').trim();
      const specialization = (rowData['specialization'] || '').trim();
      const maxGroupsRaw = (rowData['maxGroups'] || '').trim();
      const departmentCode = (rowData['departmentCode'] || '').trim();

      if (!email) {
        results.push({
          rowNumber: r,
          email: '(Trống)',
          fullName: fullName || '(Trống)',
          status: 'ERROR',
          message: 'Cột Email không được để trống.',
        });
        continue;
      }

      if (!email.includes('@')) {
        results.push({
          rowNumber: r,
          email,
          fullName: fullName || '(Trống)',
          status: 'ERROR',
          message: 'Địa chỉ Email không đúng định dạng.',
        });
        continue;
      }

      if (!fullName) {
        results.push({
          rowNumber: r,
          email,
          fullName: '(Trống)',
          status: 'ERROR',
          message: 'Họ và tên không được để trống.',
        });
        continue;
      }

      const role = this.parseRole(rawRole, studentCode, lecturerCode, genericCode);

      if (role === RoleCode.SINH_VIEN && !studentCode && genericCode) {
        studentCode = genericCode;
      } else if (
        (role === RoleCode.GIANG_VIEN ||
          role === RoleCode.TRUONG_BO_MON ||
          role === RoleCode.QUAN_LY_BO_MON) &&
        !lecturerCode &&
        genericCode
      ) {
        lecturerCode = genericCode;
      }

      const cohort = cohortRaw ? parseInt(cohortRaw, 10) : undefined;
      const creditsEarned = creditsRaw ? parseInt(creditsRaw, 10) : undefined;
      const gpa = gpaRaw ? parseFloat(gpaRaw) : undefined;
      const eligible = eligibleRaw ? this.parseBoolean(eligibleRaw) : true;
      const maxGroups = maxGroupsRaw ? parseInt(maxGroupsRaw, 10) : undefined;

      const dto: CreateUserDto = {
        email,
        fullName,
        role,
        password: password || undefined,
        phone: phone || undefined,
        studentCode: studentCode || undefined,
        className: className || undefined,
        cohort: !isNaN(cohort as any) ? cohort : undefined,
        creditsEarned: !isNaN(creditsEarned as any) ? creditsEarned : undefined,
        gpa: !isNaN(gpa as any) ? gpa : undefined,
        eligible,
        lecturerCode: lecturerCode || undefined,
        title: title || undefined,
        specialization: specialization || undefined,
        maxGroups: !isNaN(maxGroups as any) ? maxGroups : undefined,
        departmentCode: departmentCode || undefined,
      };

      try {
        await this.createUser(dto, adminId);
        results.push({
          rowNumber: r,
          email,
          fullName,
          role,
          status: 'SUCCESS',
        });
      } catch (err: any) {
        results.push({
          rowNumber: r,
          email,
          fullName,
          role,
          status: 'ERROR',
          message: err.message || 'Lỗi tạo tài khoản',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const failureCount = results.filter((r) => r.status === 'ERROR').length;

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId || null,
          action: 'ADMIN_IMPORT_EXCEL_USERS',
          entity: 'User',
          metadata: {
            filename: file.originalname,
            totalRows: results.length,
            successCount,
            failureCount,
          },
        },
      });
    } catch {}

    return {
      totalRows: results.length,
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * Cập nhật thông tin tài khoản
   */
  async updateUser(id: string, dto: UpdateUserDto, adminId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        studentProfile: true,
        lecturerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    // 1. Kiểm tra email nếu thay đổi
    if (dto.email && dto.email.toLowerCase().trim() !== user.email) {
      const email = dto.email.toLowerCase().trim();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new ConflictException(`Email '${email}' đã được tài khoản khác sử dụng.`);
      }
    }

    // 2. Chuẩn bị dữ liệu cập nhật User
    const userData: any = {};
    if (dto.email) userData.email = dto.email.toLowerCase().trim();
    if (dto.fullName) userData.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) userData.phone = dto.phone?.trim() || null;
    if (dto.status) userData.status = dto.status;
    if (dto.password) {
      userData.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    // Kiểm tra quy chế nhân sự: Hệ thống chỉ có DUY NHẤT 1 Trưởng bộ môn và 1 Quản lý bộ môn
    if (dto.role === RoleCode.TRUONG_BO_MON) {
      const existingTBM = await this.prisma.userRole.findFirst({
        where: {
          role: { code: RoleCode.TRUONG_BO_MON },
          userId: { not: id },
        },
        include: { user: true },
      });
      if (existingTBM) {
        throw new BadRequestException(
          `Hệ thống chỉ cho phép duy nhất 1 Trưởng bộ môn. Hiện tại vị trí này đang do '${existingTBM.user.fullName}' (${existingTBM.user.email}) đảm nhiệm. Vui lòng chuyển giao chức vụ hoặc đổi vai trò của nhân sự hiện tại trước.`,
        );
      }
    }

    if (dto.role === RoleCode.QUAN_LY_BO_MON) {
      const existingQL = await this.prisma.userRole.findFirst({
        where: {
          role: { code: RoleCode.QUAN_LY_BO_MON },
          userId: { not: id },
        },
        include: { user: true },
      });
      if (existingQL) {
        throw new BadRequestException(
          `Hệ thống chỉ cho phép duy nhất 1 Quản lý bộ môn. Hiện tại vị trí này đang do '${existingQL.user.fullName}' (${existingQL.user.email}) đảm nhiệm. Vui lòng chuyển giao chức vụ hoặc đổi vai trò của nhân sự hiện tại trước.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Cập nhật bảng User
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id },
          data: userData,
        });
      }

      // Cập nhật Vai trò nếu được chỉ định
      if (dto.role) {
        const newRole = await tx.role.findUnique({ where: { code: dto.role } });
        if (newRole) {
          // Xóa các role cũ và gán role mới
          await tx.userRole.deleteMany({ where: { userId: id } });
          await tx.userRole.create({
            data: {
              userId: id,
              roleId: newRole.id,
            },
          });
        }
      }

      // Cập nhật StudentProfile nếu có
      if (user.studentProfile) {
        const studentData: any = {};
        if (dto.studentCode) studentData.studentCode = dto.studentCode.trim();
        if (dto.className !== undefined) studentData.className = dto.className?.trim() || null;
        if (dto.cohort !== undefined) studentData.cohort = dto.cohort;
        if (dto.creditsEarned !== undefined) studentData.creditsEarned = dto.creditsEarned;
        if (dto.gpa !== undefined) studentData.gpa = dto.gpa;
        if (dto.eligible !== undefined) studentData.eligible = dto.eligible;

        if (Object.keys(studentData).length > 0) {
          await tx.studentProfile.update({
            where: { userId: id },
            data: studentData,
          });
        }
      }

      // Cập nhật LecturerProfile nếu có
      if (user.lecturerProfile) {
        const lecturerData: any = {};
        if (dto.lecturerCode) lecturerData.lecturerCode = dto.lecturerCode.trim();
        if (dto.title !== undefined) lecturerData.title = dto.title?.trim() || null;
        if (dto.specialization !== undefined) lecturerData.specialization = dto.specialization?.trim() || null;
        if (dto.maxGroups !== undefined) lecturerData.maxGroups = dto.maxGroups;

        if (Object.keys(lecturerData).length > 0) {
          await tx.lecturerProfile.update({
            where: { userId: id },
            data: lecturerData,
          });
        }
      }
    });

    // Ghi Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId || null,
          action: 'ADMIN_UPDATE_USER',
          entity: 'User',
          entityId: id,
          metadata: {
            updatedFields: Object.keys(dto),
          },
        },
      });
    } catch {}

    return this.getUserById(id);
  }

  /**
   * Cập nhật trạng thái tài khoản (Khóa / Mở khóa / Kích hoạt)
   */
  async updateUserStatus(id: string, dto: UpdateUserStatusDto, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId || null,
          action: 'ADMIN_CHANGE_USER_STATUS',
          entity: 'User',
          entityId: id,
          metadata: {
            oldStatus: user.status,
            newStatus: dto.status,
            reason: dto.reason || 'Cập nhật bởi Quản trị viên',
          },
        },
      });
    } catch {}

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      status: updated.status,
      message:
        dto.status === UserStatus.LOCKED
          ? 'Đã khóa tài khoản thành công'
          : dto.status === UserStatus.ACTIVE
          ? 'Đã mở khóa / kích hoạt tài khoản thành công'
          : 'Đã cập nhật trạng thái tài khoản',
    };
  }

  /**
   * Đặt lại mật khẩu tài khoản bởi Quản trị viên
   */
  async resetPassword(id: string, dto: ResetPasswordAdminDto, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    const rawPassword = dto.newPassword || 'Password@123';
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetUntil: null,
        refreshTokenHash: null, // Đăng xuất người dùng khỏi các phiên đăng nhập khác
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId || null,
          action: 'ADMIN_RESET_PASSWORD',
          entity: 'User',
          entityId: id,
          metadata: {
            resetBy: adminId,
            defaultPasswordUsed: !dto.newPassword,
          },
        },
      });
    } catch {}

    return {
      id: user.id,
      email: user.email,
      message: 'Mật khẩu đã được đặt lại thành công.',
      newPasswordHint: dto.newPassword ? 'Theo mật khẩu mới đã nhập' : 'Password@123',
    };
  }

  /**
   * Xóa tài khoản an toàn
   */
  async deleteUser(id: string, adminId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ownedTopics: { take: 1 },
        submissions: { take: 1 },
        scores: { take: 1 },
        studentProfile: {
          include: {
            registrations: { take: 1 },
            groupMembers: { take: 1 },
          },
        },
        lecturerProfile: {
          include: {
            reviewerAssignments: { take: 1 },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    // Kiểm tra dữ liệu khóa luận quan trọng không thể xóa thẳng
    const hasData =
      user.ownedTopics.length > 0 ||
      user.submissions.length > 0 ||
      user.scores.length > 0 ||
      (user.studentProfile?.registrations?.length ?? 0) > 0 ||
      (user.studentProfile?.groupMembers?.length ?? 0) > 0 ||
      (user.lecturerProfile?.reviewerAssignments?.length ?? 0) > 0;

    if (hasData) {
      throw new BadRequestException(
        'Tài khoản này đã có lịch sử dữ liệu KLTN (đề tài, đăng ký, bài nộp, điểm). Vui lòng chuyển trạng thái sang [LOCKED/Đã khóa] thay vì xóa để bảo toàn dữ liệu học vụ.',
      );
    }

    await this.prisma.user.delete({ where: { id } });

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId || null,
          action: 'ADMIN_DELETE_USER',
          entity: 'User',
          entityId: id,
          metadata: {
            email: user.email,
            fullName: user.fullName,
          },
        },
      });
    } catch {}

    return { success: true, message: 'Đã xóa tài khoản người dùng thành công' };
  }

  // ==========================================
  // ĐÓNG / MỞ HỆ THỐNG & CÁC CỔNG CHỨC NĂNG
  // ==========================================

  /**
   * Lấy trạng thái hoạt động toàn hệ thống
   */
  async getSystemStatus() {
    const config = await this.prisma.systemConfig.findFirst({
      where: { key: 'SYSTEM_STATUS', semesterId: null, departmentId: null },
    });

    if (config?.value && typeof config.value === 'object') {
      return config.value as any;
    }

    return {
      status: SystemOperationalMode.OPEN,
      message: 'Hệ thống KLTN đang mở và hoạt động bình thường.',
      maintenanceUntil: null,
      allowAdminOnly: false,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Cập nhật trạng thái đóng / mở toàn hệ thống (Bảo trì / Mở hoạt động / Chỉ xem)
   */
  async updateSystemStatus(dto: UpdateSystemStatusDto, adminId?: string) {
    const payload = {
      status: dto.status,
      message:
        dto.message ||
        (dto.status === SystemOperationalMode.MAINTENANCE
          ? 'Hệ thống đang tạm đóng để bảo trì cơ sở dữ liệu. Vui lòng quay lại sau.'
          : dto.status === SystemOperationalMode.READ_ONLY
          ? 'Hệ thống đang ở chế độ chỉ đọc. Không thể thực hiện các thao tác ghi dữ liệu mới.'
          : 'Hệ thống KLTN đang mở và hoạt động bình thường.'),
      maintenanceUntil: dto.maintenanceUntil || null,
      allowAdminOnly: dto.allowAdminOnly ?? true,
      updatedAt: new Date().toISOString(),
    };

    const existing = await this.prisma.systemConfig.findFirst({
      where: { key: 'SYSTEM_STATUS', semesterId: null, departmentId: null },
    });

    if (existing) {
      await this.prisma.systemConfig.update({
        where: { id: existing.id },
        data: {
          value: payload,
          description: 'Cấu hình trạng thái đóng/mở toàn hệ thống KLTN',
        },
      });
    } else {
      await this.prisma.systemConfig.create({
        data: {
          key: 'SYSTEM_STATUS',
          value: payload,
          description: 'Cấu hình trạng thái đóng/mở toàn hệ thống KLTN',
        },
      });
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId || null,
          action: 'ADMIN_CHANGE_SYSTEM_STATUS',
          entity: 'SystemConfig',
          metadata: payload,
        },
      });
    } catch {}

    return payload;
  }

  /**
   * Lấy cấu hình các cổng nghiệp vụ (Đăng ký, đề xuất, nộp bài, chấm điểm, phúc khảo)
   */
  async getModuleSwitches() {
    const config = await this.prisma.systemConfig.findFirst({
      where: { key: 'MODULE_SWITCHES', semesterId: null, departmentId: null },
    });

    const defaults = {
      registrationOpen: true,
      registrationNote: 'Cổng đăng ký đề tài KLTN',
      proposalOpen: true,
      proposalNote: 'Cổng đề xuất đề tài mới của sinh viên & giảng viên',
      submissionOpen: true,
      submissionNote: 'Cổng nộp báo cáo tiến độ và khóa luận',
      scoringOpen: true,
      scoringNote: 'Cổng nhập điểm và phân công phản biện',
      scoreAppealOpen: true,
      scoreAppealNote: 'Cổng gửi yêu cầu phúc khảo và điều chỉnh điểm',
      updatedAt: new Date().toISOString(),
    };

    if (config?.value && typeof config.value === 'object') {
      return { ...defaults, ...(config.value as any) };
    }

    return defaults;
  }

  /**
   * Đóng / mở các cổng chức năng KLTN
   */
  async updateModuleSwitches(dto: UpdateModuleSwitchesDto, adminId?: string) {
    const current = await this.getModuleSwitches();
    const updated = {
      ...current,
      ...dto,
      updatedAt: new Date().toISOString(),
    };

    const existing = await this.prisma.systemConfig.findFirst({
      where: { key: 'MODULE_SWITCHES', semesterId: null, departmentId: null },
    });

    if (existing) {
      await this.prisma.systemConfig.update({
        where: { id: existing.id },
        data: {
          value: updated,
          description: 'Cấu hình đóng/mở các cổng chức năng nghiệp vụ KLTN',
        },
      });
    } else {
      await this.prisma.systemConfig.create({
        data: {
          key: 'MODULE_SWITCHES',
          value: updated,
          description: 'Cấu hình đóng/mở các cổng chức năng nghiệp vụ KLTN',
        },
      });
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId || null,
          action: 'ADMIN_UPDATE_MODULE_SWITCHES',
          entity: 'SystemConfig',
          metadata: updated,
        },
      });
    } catch {}

    return updated;
  }

  /**
   * Chuyển giao vị trí Trưởng bộ môn hoặc Quản lý bộ môn cho nhân sự mới
   * (Đảm bảo luôn chỉ có duy nhất 1 Trưởng bộ môn và 1 Quản lý bộ môn)
   */
  async transferLeadershipRole(
    targetRole: 'TRUONG_BO_MON' | 'QUAN_LY_BO_MON',
    successorUserId: string,
    adminId?: string,
  ) {
    const roleRecord = await this.prisma.role.findUnique({ where: { code: targetRole } });
    const lecturerRole = await this.prisma.role.findUnique({ where: { code: RoleCode.GIANG_VIEN } });
    if (!roleRecord || !lecturerRole) {
      throw new BadRequestException('Không tìm thấy vai trò tương ứng trong hệ thống');
    }

    const successor = await this.prisma.user.findUnique({
      where: { id: successorUserId },
      include: { roles: { include: { role: true } }, lecturerProfile: true },
    });
    if (!successor) {
      throw new NotFoundException('Không tìm thấy nhân sự được bổ nhiệm');
    }

    const roleName = targetRole === RoleCode.TRUONG_BO_MON ? 'Trưởng bộ môn' : 'Quản lý bộ môn';

    return await this.prisma.$transaction(async (tx) => {
      // 1. Tìm tất cả người đang giữ chức vụ này hiện tại (nếu có)
      const currentHolders = await tx.userRole.findMany({
        where: { roleId: roleRecord.id },
        include: { user: true },
      });

      // Nếu người được bổ nhiệm chính là người hiện tại duy nhất
      if (
        currentHolders.length === 1 &&
        currentHolders[0].userId === successorUserId
      ) {
        return {
          success: true,
          message: `${successor.fullName} hiện đã là ${roleName}.`,
        };
      }

      // 2. Chuyển người giữ chức vụ cũ về vai trò GIANG_VIEN
      for (const holder of currentHolders) {
        if (holder.userId !== successorUserId) {
          await tx.userRole.deleteMany({
            where: { userId: holder.userId, roleId: roleRecord.id },
          });
          await tx.userRole.upsert({
            where: {
              userId_roleId: {
                userId: holder.userId,
                roleId: lecturerRole.id,
              },
            },
            update: {},
            create: {
              userId: holder.userId,
              roleId: lecturerRole.id,
            },
          });
        }
      }

      // 3. Gán chức vụ mới cho nhân sự kế nhiệm (và bảo toàn vai trò GIANG_VIEN kế thừa)
      const otherLeadershipCode =
        targetRole === RoleCode.TRUONG_BO_MON
          ? RoleCode.QUAN_LY_BO_MON
          : RoleCode.TRUONG_BO_MON;
      const otherLeadershipRole = await tx.role.findUnique({
        where: { code: otherLeadershipCode },
      });
      if (otherLeadershipRole) {
        await tx.userRole.deleteMany({
          where: {
            userId: successorUserId,
            roleId: otherLeadershipRole.id,
          },
        });
      }

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: successorUserId,
            roleId: roleRecord.id,
          },
        },
        update: {},
        create: {
          userId: successorUserId,
          roleId: roleRecord.id,
        },
      });

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: successorUserId,
            roleId: lecturerRole.id,
          },
        },
        update: {},
        create: {
          userId: successorUserId,
          roleId: lecturerRole.id,
        },
      });

      // 4. Đảm bảo nhân sự kế nhiệm có LecturerProfile và học vị phù hợp
      if (!successor.lecturerProfile) {
        let defaultDept = await tx.department.findFirst();
        if (!defaultDept) {
          defaultDept = await tx.department.create({
            data: {
              code: 'CNTT',
              name: 'Công nghệ Thông tin',
            },
          });
        }
        await tx.lecturerProfile.create({
          data: {
            userId: successorUserId,
            lecturerCode: `GV${Date.now().toString().slice(-4)}`,
            title: targetRole === RoleCode.TRUONG_BO_MON ? 'PGS. TS.' : 'ThS.',
            departmentId: defaultDept.id,
          },
        });
      } else if (!successor.lecturerProfile.title) {
        await tx.lecturerProfile.update({
          where: { id: successor.lecturerProfile.id },
          data: {
            title: targetRole === RoleCode.TRUONG_BO_MON ? 'PGS. TS.' : 'ThS.',
          },
        });
      }

      // 5. Ghi log kiểm toán
      const previousNames = currentHolders
        .filter((h) => h.userId !== successorUserId)
        .map((h) => h.user.fullName)
        .join(', ');

      try {
        await tx.auditLog.create({
          data: {
            userId: adminId || null,
            action: 'ADMIN_TRANSFER_LEADERSHIP',
            entity: 'UserRole',
            entityId: successorUserId,
            metadata: {
              role: targetRole,
              roleName,
              predecessors: previousNames || null,
              successorId: successorUserId,
              successorName: successor.fullName,
            },
          },
        });
      } catch {}

      return {
        success: true,
        message: `Đã bổ nhiệm thành công ${successor.fullName} làm ${roleName}!${
          previousNames ? ` (Bàn giao từ ${previousNames})` : ''
        }`,
      };
    });
  }
}

