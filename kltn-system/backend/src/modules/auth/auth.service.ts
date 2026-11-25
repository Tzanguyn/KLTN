import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CaptchaService } from './captcha.service';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface FailedLoginAttempt {
  count: number;
  firstAttemptAt: number;
}

@Injectable()
export class AuthService {
  // Bộ nhớ đệm lưu trữ số lần đăng nhập sai theo identifier (Giới hạn 5 lần / 15 phút)
  private readonly failedAttempts = new Map<string, FailedLoginAttempt>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly captchaService: CaptchaService,
  ) {}

  generateCaptcha() {
    return this.captchaService.generateCaptcha();
  }

  /**
   * Lấy trạng thái hoạt động / bảo trì của hệ thống (công khai cho màn hình Login)
   */
  async getSystemStatus() {
    const config = await this.prisma.systemConfig.findFirst({
      where: { key: 'SYSTEM_STATUS', semesterId: null, departmentId: null },
    });

    if (config?.value && typeof config.value === 'object') {
      return config.value as any;
    }

    return {
      status: 'OPEN',
      message: 'Hệ thống KLTN đang mở và hoạt động bình thường.',
      maintenanceUntil: null,
      allowAdminOnly: false,
      updatedAt: new Date().toISOString(),
    };
  }

  private checkRateLimit(key: string) {
    const now = Date.now();
    const record = this.failedAttempts.get(key);
    if (!record) return;

    const fifteenMinutesMs = 15 * 60 * 1000;
    if (now - record.firstAttemptAt > fifteenMinutesMs) {
      this.failedAttempts.delete(key);
      return;
    }

    if (record.count >= 5) {
      const remainingMinutes = Math.max(1, Math.ceil((record.firstAttemptAt + fifteenMinutesMs - now) / 60000));
      throw new HttpException(
        `Bạn đã nhập sai thông tin 5 lần. Vui lòng thử lại sau ${remainingMinutes} phút.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailedAttempt(key: string) {
    const now = Date.now();
    const fifteenMinutesMs = 15 * 60 * 1000;
    const record = this.failedAttempts.get(key);

    if (!record || now - record.firstAttemptAt > fifteenMinutesMs) {
      this.failedAttempts.set(key, { count: 1, firstAttemptAt: now });
    } else {
      record.count += 1;
      this.failedAttempts.set(key, record);
    }
  }

  private clearFailedAttempt(key: string) {
    this.failedAttempts.delete(key);
  }

  /**
   * Tính toán điều kiện đăng ký KLTN và trạng thái KLTN hiện tại của sinh viên
   */
  async getStudentKLTNStatus(studentProfile: {
    id: string;
    creditsEarned: number;
    eligible: boolean;
    departmentId: string;
  }) {
    const minCredits = 110;
    const hasEnoughCredits = (studentProfile.creditsEarned ?? 0) >= minCredits;
    const isExplicitlyEligible = studentProfile.eligible !== false;
    const duDieuKienDangKyKLTN = hasEnoughCredits && isExplicitlyEligible;

    if (!duDieuKienDangKyKLTN) {
      return { duDieuKienDangKyKLTN: false, trangThaiKLTN: 'CHUA_DU_DIEU_KIEN' };
    }

    // 1. Kiểm tra nếu sinh viên đã ở trong nhóm KLTN
    const groupMember = await this.prisma.groupMember.findFirst({
      where: { studentId: studentProfile.id },
      include: {
        group: {
          include: {
            defenses: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    if (groupMember?.group) {
      const group = groupMember.group;
      if (group.defenses && group.defenses.length > 0) {
        const def = group.defenses[0];
        return {
          duDieuKienDangKyKLTN: true,
          trangThaiKLTN: def.status === 'COMPLETED' ? 'DA_BAO_VE' : 'DANG_BAO_VE',
        };
      }
      if (group.midtermStatus === 'STOPPED') {
        return { duDieuKienDangKyKLTN: true, trangThaiKLTN: 'DUNG_TIEN_DO' };
      }
      if (group.status === 'COMPLETED') {
        return { duDieuKienDangKyKLTN: true, trangThaiKLTN: 'HOAN_THANH' };
      }
      if (group.status === 'ACTIVE') {
        return { duDieuKienDangKyKLTN: true, trangThaiKLTN: 'DANG_THUC_HIEN' };
      }
      return { duDieuKienDangKyKLTN: true, trangThaiKLTN: 'DANG_LAM_NHOM' };
    }

    // 2. Nếu chưa có nhóm, kiểm tra đơn đăng ký đề tài
    const registration = await this.prisma.registration.findFirst({
      where: { studentId: studentProfile.id },
      orderBy: { createdAt: 'desc' },
    });

    if (registration) {
      if (registration.status === 'APPROVED') {
        return { duDieuKienDangKyKLTN: true, trangThaiKLTN: 'DA_DUOC_DUYET_DE_TAI' };
      }
      if (registration.status === 'PENDING' || (registration.status as any) === 'CHO_XAC_NHAN') {
        return { duDieuKienDangKyKLTN: true, trangThaiKLTN: 'CHO_DUYET_DANG_KY' };
      }
      if (registration.status === 'REJECTED') {
        return { duDieuKienDangKyKLTN: true, trangThaiKLTN: 'DANG_KY_BI_TU_CHOI' };
      }
    }

    return { duDieuKienDangKyKLTN: true, trangThaiKLTN: 'CHUA_DANG_KY' };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    // 0. Kiểm tra mã CAPTCHA (nếu client gửi lên hoặc hệ thống bật cấu hình bắt buộc)
    const requireCaptcha = process.env.REQUIRE_CAPTCHA === 'true';
    if (requireCaptcha || dto.captchaId || dto.captchaCode) {
      if (!dto.captchaId || !dto.captchaCode) {
        throw new BadRequestException('Vui lòng nhập đầy đủ mã xác nhận (CAPTCHA).');
      }
      const isCaptchaValid = this.captchaService.validateCaptcha(dto.captchaId, dto.captchaCode);
      if (!isCaptchaValid) {
        throw new BadRequestException('Mã xác nhận (CAPTCHA) không chính xác hoặc đã hết hạn. Vui lòng thử lại.');
      }
    }

    const identifier = dto.identifier.toLowerCase().trim();

    // 1. Kiểm tra giới hạn 5 lần thử / 15 phút (Ngoại lệ E1)
    this.checkRateLimit(identifier);

    // 2. Tìm tài khoản qua email hoặc MSSV (không phân biệt chữ hoa chữ thường)
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { studentProfile: { studentCode: { equals: identifier, mode: 'insensitive' } } },
          { lecturerProfile: { lecturerCode: { equals: identifier, mode: 'insensitive' } } },
        ],
      },
      include: {
        roles: { include: { role: true } },
        studentProfile: { include: { department: true } },
        lecturerProfile: { include: { department: true } },
      },
    });

    // Nếu không tìm thấy người dùng -> Ghi nhận lần thử sai và trả về 401
    if (!user) {
      this.recordFailedAttempt(identifier);
      throw new UnauthorizedException('MSSV/email hoặc mật khẩu không chính xác');
    }

    // 3. Kiểm tra trạng thái tài khoản (Ngoại lệ E2: Tài khoản bị khóa)
    if (user.status === 'LOCKED') {
      throw new ForbiddenException('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
    }
    if (user.status === 'INACTIVE') {
      throw new ForbiddenException('Tài khoản chưa được kích hoạt. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
    }

    // 4. Kiểm tra mật khẩu (bcrypt)
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.recordFailedAttempt(identifier);
      throw new UnauthorizedException('MSSV/email hoặc mật khẩu không chính xác');
    }

    // Đăng nhập thành công: xóa lịch sử thử sai
    this.clearFailedAttempt(identifier);

    const roles = user.roles.map(({ role }) => role.code);
    // Trưởng bộ môn kế thừa toàn bộ chức năng của Giảng viên
    if (roles.includes('TRUONG_BO_MON') && !roles.includes('GIANG_VIEN')) {
      roles.push('GIANG_VIEN');
    }
    const isStudent = roles.includes('SINH_VIEN');

    // 5. Kiểm tra điều kiện đăng ký KLTN & Trạng thái KLTN hiện tại
    let duDieuKienDangKyKLTN = true;
    let trangThaiKLTN = 'KHONG_AP_DUNG';

    if (isStudent && user.studentProfile) {
      const statusInfo = await this.getStudentKLTNStatus(user.studentProfile);
      duDieuKienDangKyKLTN = statusInfo.duDieuKienDangKyKLTN;
      trangThaiKLTN = statusInfo.trangThaiKLTN;
    }

    // 6. Ký JWT Access Token (15 phút) & Refresh Token (7 ngày)
    const payload = { sub: user.id, email: user.email, roles };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as any,
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as any,
      },
    );

    // 7. Cập nhật lastLoginAt và lưu hash Refresh Token
    const isFirstLogin = user.lastLoginAt === null;
    const hasContactInfo = Boolean(user.phone && user.studentProfile?.personalEmail);
    const requireProfileUpdate = isStudent && (isFirstLogin || !hasContactInfo);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        refreshTokenHash: await bcrypt.hash(refreshToken, 12),
      },
    });

    // 8. Ghi log đăng nhập vào bảng audit_logs
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: {
            identifier,
            role: roles[0],
            duDieuKienDangKyKLTN,
            trangThaiKLTN,
            isFirstLogin,
            requireProfileUpdate,
          },
        },
      });
    } catch {
      // Bỏ qua lỗi ghi audit để không chặn luồng đăng nhập
    }

    const isLecturerRole =
      roles.includes('GIANG_VIEN') ||
      roles.includes('TRUONG_BO_MON') ||
      roles.includes('QUAN_LY_BO_MON');

    if (!user.lecturerProfile && isLecturerRole) {
      const defaultDept = await this.prisma.department.findFirst({
        where: { code: { in: ['IS', 'CNTT'] } },
      });
      if (defaultDept) {
        user.lecturerProfile = await this.prisma.lecturerProfile.create({
          data: {
            userId: user.id,
            lecturerCode: user.email === 'quanly@kltn.edu.vn' ? 'QL001' : `GV_${user.id.slice(0, 6).toUpperCase()}`,
            title: roles.includes('TRUONG_BO_MON') ? 'PGS. TS.' : 'ThS.',
            specialization: 'Hệ thống thông tin',
            departmentId: defaultDept.id,
            maxGroups: 10,
          },
          include: { department: true },
        });
      }
    }

    if (user.lecturerProfile && user.email === 'quanly@kltn.edu.vn') {
      user.lecturerProfile.maxGroups = 10;
    }

    const formattedUser = {
      id: user.id,
      mssv: user.studentProfile?.studentCode ?? null,
      hoTen: user.fullName,
      fullName: user.fullName,
      email: user.email,
      role: roles[0],
      roles,
      duDieuKienDangKyKLTN,
      eligible: duDieuKienDangKyKLTN,
      trangThaiKLTN,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isFirstLogin,
      requireProfileUpdate,
      hasContactInfo,
      studentProfile: user.studentProfile
        ? {
            studentCode: user.studentProfile.studentCode,
            className: user.studentProfile.className,
            cohort: user.studentProfile.cohort,
            gpa: user.studentProfile.gpa ? Number(user.studentProfile.gpa) : undefined,
            creditsEarned: user.studentProfile.creditsEarned,
            eligible: duDieuKienDangKyKLTN,
            department: user.studentProfile.department,
            personalEmail: user.studentProfile.personalEmail,
            address: user.studentProfile.address,
            contactInfo: user.studentProfile.contactInfo,
          }
        : undefined,
      lecturerProfile: user.lecturerProfile
        ? {
            lecturerCode: user.lecturerProfile.lecturerCode,
            title: user.lecturerProfile.title,
            specialization: user.lecturerProfile.specialization,
            maxGroups: user.lecturerProfile.maxGroups,
            department: user.lecturerProfile.department,
          }
        : undefined,
    };

    return {
      accessToken,
      refreshToken,
      user: formattedUser,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          roles: { include: { role: true } },
          studentProfile: { include: { department: true } },
          lecturerProfile: { include: { department: true } },
        },
      });
      if (!user?.refreshTokenHash || !(await bcrypt.compare(refreshToken, user.refreshTokenHash))) {
        throw new UnauthorizedException('Refresh token không hợp lệ');
      }
      const roles = user.roles.map(({ role }) => role.code);
      // Trưởng bộ môn kế thừa toàn bộ chức năng của Giảng viên
      if (roles.includes('TRUONG_BO_MON') && !roles.includes('GIANG_VIEN')) {
        roles.push('GIANG_VIEN');
      }
      const isStudent = roles.includes('SINH_VIEN');
      let duDieuKienDangKyKLTN = true;
      let trangThaiKLTN = 'KHONG_AP_DUNG';

      if (isStudent && user.studentProfile) {
        const statusInfo = await this.getStudentKLTNStatus(user.studentProfile);
        duDieuKienDangKyKLTN = statusInfo.duDieuKienDangKyKLTN;
        trangThaiKLTN = statusInfo.trangThaiKLTN;
      }

      const accessToken = await this.jwt.signAsync(
        { sub: user.id, email: user.email, roles },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' as any },
      );

      return {
        accessToken,
        user: {
          id: user.id,
          mssv: user.studentProfile?.studentCode ?? null,
          hoTen: user.fullName,
          fullName: user.fullName,
          email: user.email,
          role: roles[0],
          roles,
          duDieuKienDangKyKLTN,
          eligible: duDieuKienDangKyKLTN,
          trangThaiKLTN,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
        },
      };
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        status: true,
        roles: { include: { role: true } },
        studentProfile: { include: { department: true } },
        lecturerProfile: { include: { department: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');

    const roles = user.roles.map(({ role }) => role.code);
    const isStudent = roles.includes('SINH_VIEN');
    let duDieuKienDangKyKLTN = true;
    let trangThaiKLTN = 'KHONG_AP_DUNG';

    if (isStudent && user.studentProfile) {
      const statusInfo = await this.getStudentKLTNStatus(user.studentProfile);
      duDieuKienDangKyKLTN = statusInfo.duDieuKienDangKyKLTN;
      trangThaiKLTN = statusInfo.trangThaiKLTN;
    }

    const hasContactInfo = Boolean(user.phone && user.studentProfile?.personalEmail);
    const requireProfileUpdate = isStudent && !hasContactInfo;

    const isLecturerRole =
      roles.includes('GIANG_VIEN') ||
      roles.includes('TRUONG_BO_MON') ||
      roles.includes('QUAN_LY_BO_MON');

    if (!user.lecturerProfile && isLecturerRole) {
      const defaultDept = await this.prisma.department.findFirst({
        where: { code: { in: ['IS', 'CNTT'] } },
      });
      if (defaultDept) {
        user.lecturerProfile = await this.prisma.lecturerProfile.create({
          data: {
            userId: user.id,
            lecturerCode: user.email === 'quanly@kltn.edu.vn' ? 'QL001' : `GV_${user.id.slice(0, 6).toUpperCase()}`,
            title: roles.includes('TRUONG_BO_MON') ? 'PGS. TS.' : 'ThS.',
            specialization: 'Hệ thống thông tin',
            departmentId: defaultDept.id,
            maxGroups: 10,
          },
          include: { department: true },
        });
      }
    }

    if (user.lecturerProfile && user.email === 'quanly@kltn.edu.vn') {
      user.lecturerProfile.maxGroups = 10;
    }

    return {
      ...user,
      mssv: user.studentProfile?.studentCode ?? null,
      hoTen: user.fullName,
      role: roles[0],
      roles,
      duDieuKienDangKyKLTN,
      eligible: duDieuKienDangKyKLTN,
      trangThaiKLTN,
      requireProfileUpdate,
      hasContactInfo,
      studentProfile: user.studentProfile
        ? {
            ...user.studentProfile,
            gpa: user.studentProfile.gpa ? Number(user.studentProfile.gpa) : undefined,
          }
        : undefined,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return { message: 'Nếu email tồn tại trên hệ thống, yêu cầu đặt lại mật khẩu đã được xử lý.' };
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetUntil: expiresAt },
    });
    return {
      message: 'Mã đặt lại mật khẩu đã được tạo (hiệu lực 15 phút).',
      resetToken: process.env.NODE_ENV === 'production' ? undefined : token,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetUntil: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('Mã token không hợp lệ hoặc đã hết hạn.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetUntil: null,
        refreshTokenHash: null,
      },
    });
    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' };
  }
}
