import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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
            phone: head.user.phone,
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
            phone: manager.user.phone,
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

