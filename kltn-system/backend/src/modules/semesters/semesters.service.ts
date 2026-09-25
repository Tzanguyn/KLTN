import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Semester, SemesterStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { SemesterQueryDto } from './dto/semester-query.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';
import { SetRegistrationPeriodDto } from './dto/set-registration-period.dto';
import { SetRegistrationConditionsDto } from './dto/set-registration-conditions.dto';

@Injectable()
export class SemestersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper định dạng ngày theo DD/MM/YYYY cho thông báo lỗi
   */
  private formatDate(date?: Date | null): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getFullYear()}`;
  }

  /**
   * Bổ sung các alias tiếng Việt vào response để frontend/client dễ dàng sử dụng
   */
  private formatSemester(semester: any) {
    if (!semester) return null;
    return {
      ...semester,
      tenHocKy: semester.name,
      namHoc: semester.academicYear,
      maHocKy: semester.code,
      trangThai: semester.status,
      boMonId: semester.departmentId,
      thoiGianBatDau: semester.registrationFrom,
      thoiGianKetThuc: semester.defenseTo ?? semester.registrationTo,
      thoiGianBatDauDangKy: semester.registrationFrom,
      thoiGianKetThucDangKy: semester.registrationTo,
      thoiGianNopBaoCao: semester.submissionTo,
      thoiGianBatDauBaoVe: semester.defenseFrom,
      thoiGianKetThucBaoVe: semester.defenseTo,
    };
  }

  /**
   * Tự động sinh mã đợt chuẩn hóa từ tên học kỳ và năm học
   */
  private generateCode(name: string, academicYear: string): string {
    const cleanYear = academicYear.replace(/\s+/g, '');
    const cleanName = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .toUpperCase();
    return `${cleanYear}-${cleanName}`.slice(0, 30);
  }

  /**
   * Kiểm tra không trùng đợt (Duplicate checks):
   * 1. Không trùng mã đợt (code)
   * 2. Không trùng tên học kỳ trong cùng năm học (name + academicYear)
   * 3. Không trùng khoảng thời gian tổ chức với đợt KLTN khác (overlapping time range)
   */
  async checkDuplicateSemester(params: {
    id?: string;
    code: string;
    name: string;
    academicYear: string;
    departmentId: string;
    startDate?: Date | null;
    endDate?: Date | null;
  }) {
    const { id, code, name, academicYear, departmentId, startDate, endDate } = params;

    // 1. Kiểm tra trùng mã đợt (code)
    const existingCode = await this.prisma.semester.findFirst({
      where: {
        code: { equals: code.trim(), mode: 'insensitive' },
        ...(id ? { id: { not: id } } : {}),
      },
    });
    if (existingCode) {
      throw new BadRequestException(
        `Mã đợt "${code}" đã tồn tại trong hệ thống. Vui lòng chọn mã đợt khác.`,
      );
    }

    // 2. Kiểm tra trùng tên học kỳ trong cùng năm học và cùng bộ môn
    const existingNameInYear = await this.prisma.semester.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        academicYear: { equals: academicYear.trim(), mode: 'insensitive' },
        departmentId,
        ...(id ? { id: { not: id } } : {}),
      },
    });
    if (existingNameInYear) {
      throw new BadRequestException(
        `Đợt KLTN "${name}" đã tồn tại trong năm học ${academicYear}.`,
      );
    }

    // 3. Kiểm tra trùng khoảng thời gian (Overlapping Date Range)
    if (startDate && endDate) {
      // Tìm các đợt khác đang hoạt động trong cùng bộ môn (ngoại trừ ARCHIVED)
      const otherSemesters = await this.prisma.semester.findMany({
        where: {
          departmentId,
          status: { not: SemesterStatus.ARCHIVED },
          ...(id ? { id: { not: id } } : {}),
        },
      });

      for (const other of otherSemesters) {
        const otherStart = other.registrationFrom;
        const otherEnd = other.defenseTo ?? other.registrationTo;

        if (otherStart && otherEnd) {
          // Điều kiện 2 khoảng [A, B] và [C, D] giao nhau: A < D && B > C
          const isOverlapping =
            startDate.getTime() < otherEnd.getTime() &&
            endDate.getTime() > otherStart.getTime();

          if (isOverlapping) {
            throw new BadRequestException(
              `Thời gian đợt KLTN (${this.formatDate(startDate)} - ${this.formatDate(
                endDate,
              )}) bị trùng với đợt "${other.name}" (${this.formatDate(
                otherStart,
              )} - ${this.formatDate(otherEnd)}). Vui lòng chọn khoảng thời gian khác.`,
            );
          }
        }
      }
    }
  }

  /**
   * Lấy danh sách đợt KLTN (GET /semesters)
   */
  async findMany(query: SemesterQueryDto) {
    const search = query.search || query.q;
    const status = query.status || query.trangThai;
    const academicYear = query.academicYear || query.namHoc;
    const departmentId = query.departmentId || query.boMonId;

    const where: Prisma.SemesterWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (academicYear) {
      where.academicYear = { contains: academicYear, mode: 'insensitive' };
    }
    if (departmentId) {
      where.departmentId = departmentId;
    }

    const semesters = await this.prisma.semester.findMany({
      where,
      include: {
        department: true,
        _count: {
          select: {
            topics: true,
            groups: true,
            registrations: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return semesters.map((sem) => this.formatSemester(sem));
  }

  /**
   * Lấy chi tiết đợt KLTN theo ID (GET /semesters/:id)
   */
  async findById(id: string) {
    const semester = await this.prisma.semester.findUnique({
      where: { id },
      include: {
        department: true,
        _count: {
          select: {
            topics: true,
            groups: true,
            registrations: true,
            reports: true,
            defenses: true,
          },
        },
      },
    });

    if (!semester) {
      throw new NotFoundException(`Không tìm thấy đợt KLTN với ID: ${id}`);
    }

    return this.formatSemester(semester);
  }

  /**
   * Tạo đợt KLTN mới (POST /semesters)
   */
  async create(dto: CreateSemesterDto, userId?: string) {
    // 1. Trích xuất và chuẩn hóa trường tên và năm học
    const name = (dto.tenHocKy || dto.name)?.trim();
    if (!name) {
      throw new BadRequestException('Tên học kỳ / đợt KLTN (tenHocKy/name) là bắt buộc');
    }

    const academicYear = (dto.namHoc || dto.academicYear)?.trim();
    if (!academicYear) {
      throw new BadRequestException('Năm học (namHoc/academicYear) là bắt buộc');
    }

    // 2. Xác định bộ môn (departmentId)
    let departmentId = dto.boMonId || dto.departmentId;
    if (!departmentId && userId) {
      const lecturer = await this.prisma.lecturerProfile.findUnique({
        where: { userId },
        select: { departmentId: true },
      });
      if (lecturer?.departmentId) {
        departmentId = lecturer.departmentId;
      }
    }
    if (!departmentId) {
      const defaultDept = await this.prisma.department.findFirst({
        orderBy: { code: 'asc' },
      });
      if (!defaultDept) {
        throw new BadRequestException('Không tìm thấy bộ môn nào trong hệ thống');
      }
      departmentId = defaultDept.id;
    }

    // 3. Chuẩn hóa mã đợt (code)
    let code = (dto.maHocKy || dto.code)?.trim();
    if (!code) {
      code = this.generateCode(name, academicYear);
    }

    // 4. Chuẩn hóa các mốc thời gian
    const rawStart =
      dto.thoiGianBatDau ||
      dto.registrationFrom ||
      dto.thoiGianBatDauDangKy;
    const rawEnd =
      dto.thoiGianKetThuc ||
      dto.defenseTo ||
      dto.thoiGianKetThucBaoVe ||
      dto.registrationTo ||
      dto.thoiGianKetThucDangKy;

    const startDate = rawStart ? new Date(rawStart) : null;
    const endDate = rawEnd ? new Date(rawEnd) : null;

    if (startDate && endDate && startDate.getTime() >= endDate.getTime()) {
      throw new BadRequestException(
        'Thời gian bắt đầu đợt KLTN phải diễn ra trước thời gian kết thúc.',
      );
    }

    // Đăng ký
    const registrationFrom = rawStart ? new Date(rawStart) : undefined;
    const registrationTo =
      dto.registrationTo || dto.thoiGianKetThucDangKy
        ? new Date(dto.registrationTo || dto.thoiGianKetThucDangKy!)
        : rawEnd
        ? new Date(rawEnd)
        : undefined;

    if (
      registrationFrom &&
      registrationTo &&
      registrationFrom.getTime() >= registrationTo.getTime()
    ) {
      throw new BadRequestException(
        'Thời gian mở đăng ký phải trước hạn chót đăng ký.',
      );
    }

    // Nộp bài & bảo vệ
    const submissionTo =
      dto.submissionTo || dto.thoiGianNopBaoCao
        ? new Date(dto.submissionTo || dto.thoiGianNopBaoCao!)
        : undefined;
    const defenseFrom =
      dto.defenseFrom || dto.thoiGianBatDauBaoVe
        ? new Date(dto.defenseFrom || dto.thoiGianBatDauBaoVe!)
        : undefined;
    const defenseTo =
      dto.defenseTo || dto.thoiGianKetThucBaoVe
        ? new Date(dto.defenseTo || dto.thoiGianKetThucBaoVe!)
        : rawEnd
        ? new Date(rawEnd)
        : undefined;

    if (defenseFrom && defenseTo && defenseFrom.getTime() >= defenseTo.getTime()) {
      throw new BadRequestException(
        'Thời gian bắt đầu bảo vệ phải trước thời gian kết thúc bảo vệ.',
      );
    }

    // 5. Kiểm tra không trùng đợt (Duplicate checks)
    await this.checkDuplicateSemester({
      code,
      name,
      academicYear,
      departmentId,
      startDate,
      endDate,
    });

    const status = dto.trangThai || dto.status || SemesterStatus.DRAFT;

    const created = await this.prisma.semester.create({
      data: {
        code,
        name,
        academicYear,
        status,
        departmentId,
        registrationFrom,
        registrationTo,
        submissionTo,
        defenseFrom,
        defenseTo,
      },
      include: { department: true },
    });

    return this.formatSemester(created);
  }

  /**
   * Cập nhật đợt KLTN (PATCH /semesters/:id)
   */
  async update(id: string, dto: UpdateSemesterDto) {
    const existing = await this.prisma.semester.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy đợt KLTN với ID: ${id}`);
    }

    const name = (dto.tenHocKy || dto.name)?.trim() || existing.name;
    const academicYear =
      (dto.namHoc || dto.academicYear)?.trim() || existing.academicYear;
    const code = (dto.maHocKy || dto.code)?.trim() || existing.code;
    const departmentId =
      dto.boMonId || dto.departmentId || existing.departmentId;
    const status = dto.trangThai || dto.status || existing.status;

    // Chuẩn hóa thời gian bắt đầu / kết thúc
    const rawStart =
      dto.thoiGianBatDau ||
      dto.registrationFrom ||
      dto.thoiGianBatDauDangKy;
    const rawEnd =
      dto.thoiGianKetThuc ||
      dto.defenseTo ||
      dto.thoiGianKetThucBaoVe ||
      dto.registrationTo ||
      dto.thoiGianKetThucDangKy;

    const startDate = rawStart
      ? new Date(rawStart)
      : existing.registrationFrom;
    const endDate = rawEnd
      ? new Date(rawEnd)
      : existing.defenseTo ?? existing.registrationTo;

    if (startDate && endDate && startDate.getTime() >= endDate.getTime()) {
      throw new BadRequestException(
        'Thời gian bắt đầu đợt KLTN phải diễn ra trước thời gian kết thúc.',
      );
    }

    // Kiểm tra trùng đợt (loại trừ chính id đang cập nhật)
    await this.checkDuplicateSemester({
      id,
      code,
      name,
      academicYear,
      departmentId,
      startDate,
      endDate,
    });

    // Cập nhật các trường mốc thời gian cụ thể
    const registrationFrom = rawStart
      ? new Date(rawStart)
      : undefined;
    const registrationTo =
      dto.registrationTo || dto.thoiGianKetThucDangKy
        ? new Date(dto.registrationTo || dto.thoiGianKetThucDangKy!)
        : undefined;
    const submissionTo =
      dto.submissionTo || dto.thoiGianNopBaoCao
        ? new Date(dto.submissionTo || dto.thoiGianNopBaoCao!)
        : undefined;
    const defenseFrom =
      dto.defenseFrom || dto.thoiGianBatDauBaoVe
        ? new Date(dto.defenseFrom || dto.thoiGianBatDauBaoVe!)
        : undefined;
    const defenseTo =
      dto.defenseTo || dto.thoiGianKetThucBaoVe
        ? new Date(dto.defenseTo || dto.thoiGianKetThucBaoVe!)
        : rawEnd
        ? new Date(rawEnd)
        : undefined;

    const updated = await this.prisma.semester.update({
      where: { id },
      data: {
        code,
        name,
        academicYear,
        status,
        departmentId,
        ...(registrationFrom !== undefined ? { registrationFrom } : {}),
        ...(registrationTo !== undefined ? { registrationTo } : {}),
        ...(submissionTo !== undefined ? { submissionTo } : {}),
        ...(defenseFrom !== undefined ? { defenseFrom } : {}),
        ...(defenseTo !== undefined ? { defenseTo } : {}),
      },
      include: { department: true },
    });

    return this.formatSemester(updated);
  }

  /**
   * Xóa đợt KLTN (DELETE /semesters/:id)
   */
  async delete(id: string) {
    const existing = await this.prisma.semester.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            topics: true,
            groups: true,
            registrations: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Không tìm thấy đợt KLTN với ID: ${id}`);
    }

    if (
      existing._count.topics > 0 ||
      existing._count.groups > 0 ||
      existing._count.registrations > 0
    ) {
      throw new BadRequestException(
        `Không thể xóa đợt KLTN đã có dữ liệu đề tài (${existing._count.topics}), nhóm (${existing._count.groups}) hoặc đăng ký (${existing._count.registrations}). Vui lòng chuyển trạng thái đợt sang Đóng (CLOSED) hoặc Lưu trữ (ARCHIVED).`,
      );
    }

    await this.prisma.semester.delete({
      where: { id },
    });

    return {
      message: 'Xóa đợt KLTN thành công',
      id,
    };
  }

  /**
   * Lấy cấu hình thời gian đăng ký đề tài của đợt KLTN (GET /semesters/:id/registration-period)
   */
  async getRegistrationPeriod(id: string) {
    const semester = await this.prisma.semester.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!semester) {
      throw new NotFoundException(`Không tìm thấy đợt KLTN với ID: ${id}`);
    }

    const now = new Date();
    const start = semester.registrationFrom;
    const end = semester.registrationTo;
    const isOpen =
      semester.status === SemesterStatus.OPEN &&
      Boolean(start && end && now >= start && now <= end);

    return {
      semesterId: semester.id,
      semesterCode: semester.code,
      semesterName: semester.name,
      status: semester.status,
      start,
      end,
      thoiGianBatDau: start,
      thoiGianKetThuc: end,
      isRegistrationOpen: isOpen,
      message: isOpen
        ? 'Đợt KLTN hiện đang trong thời gian mở đăng ký đề tài.'
        : start && now < start
        ? `Chưa đến thời gian đăng ký đề tài (bắt đầu lúc ${this.formatDate(start)}).`
        : end && now > end
        ? `Đã hết hạn đăng ký đề tài (kết thúc lúc ${this.formatDate(end)}).`
        : 'Đợt KLTN chưa thiết lập thời gian mở đăng ký hoặc không ở trạng thái OPEN.',
    };
  }

  /**
   * Cấu hình thời gian mở/đóng đăng ký đề tài theo đợt (PUT /semesters/:id/registration-period)
   */
  async setRegistrationPeriod(id: string, dto: SetRegistrationPeriodDto) {
    const existing = await this.prisma.semester.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Không tìm thấy đợt KLTN với ID: ${id}`);
    }

    const rawStart = dto.start || dto.thoiGianBatDau;
    const rawEnd = dto.end || dto.thoiGianKetThuc;

    if (!rawStart || !rawEnd) {
      throw new BadRequestException(
        'Vui lòng cung cấp đầy đủ thời gian bắt đầu (start) và thời gian kết thúc (end).',
      );
    }

    const startDate = new Date(rawStart);
    const endDate = new Date(rawEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException(
        'Thời gian không hợp lệ. Vui lòng cung cấp chuỗi thời gian chuẩn ISO.',
      );
    }

    if (startDate.getTime() >= endDate.getTime()) {
      throw new BadRequestException(
        'Thời gian bắt đầu đăng ký phải diễn ra trước thời gian kết thúc đăng ký.',
      );
    }

    const updated = await this.prisma.semester.update({
      where: { id },
      data: {
        registrationFrom: startDate,
        registrationTo: endDate,
      },
      include: { department: true },
    });

    const now = new Date();
    const isRegistrationOpen =
      updated.status === SemesterStatus.OPEN &&
      now >= startDate &&
      now <= endDate;

    return {
      ...this.formatSemester(updated),
      registrationPeriod: {
        start: updated.registrationFrom,
        end: updated.registrationTo,
        isRegistrationOpen,
      },
      isRegistrationOpen,
      message: isRegistrationOpen
        ? `Cấu hình thành công. Đăng ký đề tài ĐANG MỞ từ ${this.formatDate(
            startDate,
          )} đến ${this.formatDate(endDate)}.`
        : now < startDate
        ? `Cấu hình thành công. Đăng ký đề tài sẽ mở vào ${this.formatDate(startDate)}.`
        : `Cấu hình thành công. Hạn đăng ký (${this.formatDate(endDate)}) đã kết thúc.`,
    };
  }

  /**
   * Cấu hình điều kiện đăng ký KLTN cho đợt (PUT /semesters/:id/registration-conditions)
   */
  async setRegistrationConditions(
    semesterId: string,
    dto: SetRegistrationConditionsDto,
  ) {
    const semester = await this.prisma.semester.findUnique({
      where: { id: semesterId },
    });
    if (!semester) {
      throw new NotFoundException(`Không tìm thấy đợt KLTN với ID: ${semesterId}`);
    }

    const minCredits = dto.minCredits ?? dto.soTinChiToiThieu ?? 110;
    const minGpa = dto.minGpa ?? dto.diemTBToiThieu ?? dto.diemTB ?? null;
    const rawPrereqs = dto.prerequisiteCourses ?? dto.monTienQuyet ?? [];
    const prerequisiteCourses = Array.isArray(rawPrereqs)
      ? rawPrereqs.map((c) => String(c).trim()).filter(Boolean)
      : typeof rawPrereqs === 'string'
      ? (rawPrereqs as string).split(',').map((c) => c.trim()).filter(Boolean)
      : [];
    const requireEligibleFlag =
      dto.requireEligibleFlag ?? dto.yeuCauDuDieuKien ?? true;
    const description =
      dto.description ?? dto.moTa ?? 'Điều kiện đăng ký Khóa luận tốt nghiệp';

    const conditionsData = {
      minCredits,
      minGpa,
      prerequisiteCourses,
      requireEligibleFlag,
      description,
    };

    const existingConfig = await this.prisma.systemConfig.findFirst({
      where: {
        key: 'REGISTRATION_CONDITIONS',
        semesterId,
      },
    });

    if (existingConfig) {
      await this.prisma.systemConfig.update({
        where: { id: existingConfig.id },
        data: {
          value: conditionsData as any,
          description,
        },
      });
    } else {
      await this.prisma.systemConfig.create({
        data: {
          key: 'REGISTRATION_CONDITIONS',
          semesterId,
          departmentId: semester.departmentId,
          value: conditionsData as any,
          description,
        },
      });
    }

    return {
      semesterId,
      semesterCode: semester.code,
      semesterName: semester.name,
      conditions: conditionsData,
      soTinChiToiThieu: minCredits,
      diemTBToiThieu: minGpa,
      monTienQuyet: prerequisiteCourses,
      yeuCauDuDieuKien: requireEligibleFlag,
      message: 'Cấu hình điều kiện đăng ký KLTN thành công.',
    };
  }

  /**
   * Lấy cấu hình điều kiện đăng ký KLTN của đợt (GET /semesters/:id/registration-conditions)
   */
  async getRegistrationConditions(semesterId: string) {
    const semester = await this.prisma.semester.findUnique({
      where: { id: semesterId },
    });
    if (!semester) {
      throw new NotFoundException(`Không tìm thấy đợt KLTN với ID: ${semesterId}`);
    }

    const config = await this.prisma.systemConfig.findFirst({
      where: {
        key: 'REGISTRATION_CONDITIONS',
        semesterId,
      },
    });

    const defaultConditions = {
      minCredits: 110,
      minGpa: null,
      prerequisiteCourses: [],
      requireEligibleFlag: true,
      description: 'Điều kiện mặc định (tối thiểu 110 tín chỉ)',
    };

    const conditions = (config?.value as any) || defaultConditions;

    return {
      semesterId,
      semesterCode: semester.code,
      semesterName: semester.name,
      conditions,
      soTinChiToiThieu: conditions.minCredits,
      diemTBToiThieu: conditions.minGpa,
      monTienQuyet: conditions.prerequisiteCourses,
      yeuCauDuDieuKien: conditions.requireEligibleFlag,
    };
  }

  /**
   * Tự động kiểm tra các điều kiện đăng ký KLTN của sinh viên
   */
  async assertStudentMeetsConditions(semesterId: string, student: any) {
    if (!student) {
      throw new ForbiddenException('Không tìm thấy thông tin hồ sơ sinh viên');
    }

    const { conditions } = await this.getRegistrationConditions(semesterId);

    // 1. Kiểm tra trạng thái cờ eligible
    if (conditions.requireEligibleFlag && !student.eligible) {
      throw new ForbiddenException(
        'Sinh viên chưa được kích hoạt trạng thái đủ điều kiện làm Khóa luận Tốt nghiệp',
      );
    }

    // 2. Kiểm tra số tín chỉ tích lũy tối thiểu
    const minCredits = conditions.minCredits ?? 110;
    const creditsEarned = student.creditsEarned ?? 0;
    if (creditsEarned < minCredits) {
      throw new ForbiddenException(
        `Sinh viên chưa tích lũy đủ số tín chỉ tối thiểu (Yêu cầu: ${minCredits} tín chỉ, hiện có: ${creditsEarned} tín chỉ)`,
      );
    }

    // 3. Kiểm tra điểm trung bình tích lũy (GPA)
    if (conditions.minGpa != null) {
      const studentGpa = student.gpa != null ? Number(student.gpa) : 0;
      if (studentGpa < conditions.minGpa) {
        throw new ForbiddenException(
          `Điểm trung bình (GPA) chưa đạt yêu cầu tối thiểu (Yêu cầu: ${conditions.minGpa}, hiện tại: ${studentGpa.toFixed(2)})`,
        );
      }
    }

    // 4. Kiểm tra môn tiên quyết
    if (
      conditions.prerequisiteCourses &&
      Array.isArray(conditions.prerequisiteCourses) &&
      conditions.prerequisiteCourses.length > 0
    ) {
      let completedCourses: string[] = [];
      if (student.contactInfo) {
        try {
          const parsed = JSON.parse(student.contactInfo);
          if (Array.isArray(parsed)) completedCourses = parsed;
          else if (Array.isArray(parsed.completedCourses))
            completedCourses = parsed.completedCourses;
          else if (Array.isArray(parsed.courses))
            completedCourses = parsed.courses;
        } catch {
          completedCourses = student.contactInfo
            .split(',')
            .map((c: string) => c.trim());
        }
      }

      const completedLower = completedCourses.map((c: string) =>
        c.toLowerCase().trim(),
      );
      const missingCourses = conditions.prerequisiteCourses.filter(
        (reqCourse: string) =>
          !completedLower.includes(reqCourse.toLowerCase().trim()),
      );

      if (missingCourses.length > 0) {
        throw new ForbiddenException(
          `Sinh viên chưa hoàn thành các môn học tiên quyết bắt buộc (Còn thiếu: ${missingCourses.join(
            ', ',
          )})`,
        );
      }
    }
  }
}



