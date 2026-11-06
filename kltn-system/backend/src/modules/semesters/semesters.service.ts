import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, RoleCode, Semester, SemesterStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { SemesterQueryDto } from './dto/semester-query.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';
import { SetRegistrationPeriodDto } from './dto/set-registration-period.dto';
import { SetRegistrationConditionsDto } from './dto/set-registration-conditions.dto';

@Injectable()
export class SemestersService implements OnModuleInit {
  private readonly logger = new Logger(SemestersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const resetMarkerKey = 'AUTO_RESET_NEW_SEMESTER_2026_V2';
      const existingMarker = await this.prisma.systemConfig.findFirst({
        where: { key: resetMarkerKey },
      });
      if (!existingMarker) {
        this.logger.log('Đang đặt lại dữ liệu về trạng thái Mới mở học kỳ (Bước 1: Đăng ký đề tài)...');
        await this.resetToNewSemesterState();
        await this.prisma.systemConfig.create({
          data: {
            key: resetMarkerKey,
            value: new Date().toISOString(),
            description: 'Đã tự động đặt lại dữ liệu về trạng thái mới mở học kỳ để test từ đầu',
          },
        });
        this.logger.log('Đã đặt lại dữ liệu về trạng thái Mới mở học kỳ thành công!');
      }
    } catch (err: any) {
      this.logger.warn(`Không thể tự động reset dữ liệu lúc khởi động: ${err?.message}`);
    }
  }

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
   * Bổ sung các alias tiếng Việt và lộ trình 5 giai đoạn vào response để frontend/client dễ dàng sử dụng
   */
  private formatSemester(semester: any, customStep?: number) {
    if (!semester) return null;

    const now = new Date();
    const regFrom = semester.registrationFrom ? new Date(semester.registrationFrom) : null;
    const regTo = semester.registrationTo ? new Date(semester.registrationTo) : null;
    const subTo = semester.submissionTo ? new Date(semester.submissionTo) : null;
    const defFrom = semester.defenseFrom ? new Date(semester.defenseFrom) : null;
    const defTo = semester.defenseTo ? new Date(semester.defenseTo) : null;

    let midFrom: Date | null = null;
    let midTo: Date | null = null;
    if (regTo && subTo) {
      midFrom = new Date(regTo.getTime() + 7 * 86400000);
      midTo = new Date((regTo.getTime() + subTo.getTime()) / 2);
    }

    let currentStep = customStep && customStep >= 1 && customStep <= 5 ? customStep : 0;
    if (!currentStep) {
      if (semester.status === 'ARCHIVED' || semester.status === 'CLOSED') {
        currentStep = 5;
      } else if (defFrom && now >= defFrom) {
        currentStep = 5;
      } else if (subTo && now >= subTo) {
        currentStep = 4;
      } else if (midTo && now >= midTo) {
        currentStep = 3;
      } else if (regTo && now > regTo) {
        currentStep = 2;
      } else {
        // Fallback dựa trên counts nếu có
        if (semester._count?.defenses > 0) {
          currentStep = 5;
        } else if (semester._count?.reports > 0 || (semester._count?.groups > 0 && regTo && now >= regTo)) {
          currentStep = 4;
        } else if (semester._count?.groups > 0) {
          currentStep = 3;
        } else if (semester._count?.registrations > 0) {
          currentStep = 2;
        } else {
          currentStep = 1;
        }
      }
    }

    const stageTitles = [
      'Đăng ký đề tài',
      'Duyệt & Ghép nhóm',
      'Thực hiện & Giữa kỳ',
      'Báo cáo & Phản biện',
      'Bảo vệ & Tổng kết',
    ];

    const timelineSteps = [
      {
        number: 1,
        title: 'Đăng ký đề tài',
        subtitle: 'Mở đợt, chọn hoặc đề xuất đề tài mới',
        phase: 'Tuần 1 - 3',
        startDate: regFrom ? regFrom.toISOString() : null,
        endDate: regTo ? regTo.toISOString() : null,
      },
      {
        number: 2,
        title: 'Duyệt & Ghép nhóm',
        subtitle: 'GVHD duyệt, thành lập nhóm KLTN',
        phase: 'Tuần 3 - 4',
        startDate: regTo ? regTo.toISOString() : null,
        endDate: midFrom ? midFrom.toISOString() : null,
      },
      {
        number: 3,
        title: 'Thực hiện & Giữa kỳ',
        subtitle: 'Báo cáo tiến độ, đánh giá giữa kỳ',
        phase: 'Tuần 5 - 10',
        startDate: midFrom ? midFrom.toISOString() : null,
        endDate: subTo ? subTo.toISOString() : null,
      },
      {
        number: 4,
        title: 'Báo cáo & Phản biện',
        subtitle: 'Nộp báo cáo hoàn chỉnh, GV phản biện',
        phase: 'Tuần 11 - 13',
        startDate: subTo ? subTo.toISOString() : null,
        endDate: defFrom ? defFrom.toISOString() : null,
      },
      {
        number: 5,
        title: 'Bảo vệ & Tổng kết',
        subtitle: 'Hội đồng chấm điểm 10 tiêu chí, NCKH',
        phase: 'Tuần 14 - 15',
        startDate: defFrom ? defFrom.toISOString() : null,
        endDate: defTo ? defTo.toISOString() : null,
      },
    ];

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
      currentStep,
      currentStage: stageTitles[currentStep - 1] || 'Đăng ký đề tài',
      timelineSteps,
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

    const [configs, semesters] = await Promise.all([
      this.prisma.systemConfig.findMany({
        where: { key: 'SEMESTER_TIMELINE_STEP' },
      }),
      this.prisma.semester.findMany({
        where,
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
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);

    const stepMap = new Map<string, number>();
    for (const c of configs) {
      if (c.semesterId && c.value) {
        stepMap.set(c.semesterId, Number(c.value));
      }
    }

    return semesters.map((sem) => this.formatSemester(sem, stepMap.get(sem.id)));
  }

  /**
   * Lấy chi tiết đợt KLTN theo ID (GET /semesters/:id)
   */
  async findById(id: string) {
    const [semester, stepConfig] = await Promise.all([
      this.prisma.semester.findUnique({
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
      }),
      this.prisma.systemConfig.findFirst({
        where: { key: 'SEMESTER_TIMELINE_STEP', semesterId: id },
      }),
    ]);

    if (!semester) {
      throw new NotFoundException(`Không tìm thấy đợt KLTN với ID: ${id}`);
    }

    const customStep = stepConfig?.value ? Number(stepConfig.value) : undefined;
    return this.formatSemester(semester, customStep);
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

    // Cập nhật cấu hình bước lộ trình nếu có truyền vào
    const targetStep = (dto as any).currentStep ?? (dto as any).giaiDoanHienTai;
    let savedStep: number | undefined;
    if (targetStep !== undefined && targetStep !== null) {
      const stepVal = Number(targetStep);
      if (stepVal >= 1 && stepVal <= 5) {
        savedStep = stepVal;
        const existingConfig = await this.prisma.systemConfig.findFirst({
          where: { key: 'SEMESTER_TIMELINE_STEP', semesterId: id },
        });
        if (existingConfig) {
          await this.prisma.systemConfig.update({
            where: { id: existingConfig.id },
            data: { value: String(stepVal) },
          });
        } else {
          await this.prisma.systemConfig.create({
            data: {
              key: 'SEMESTER_TIMELINE_STEP',
              semesterId: id,
              value: String(stepVal),
              description: 'Giai đoạn lộ trình hiện tại của đợt KLTN',
            },
          });
        }
      } else if (stepVal === 0) {
        // 0 nghĩa là xóa ghi đè thủ công để hệ thống tự động tính theo tiến độ
        await this.prisma.systemConfig.deleteMany({
          where: { key: 'SEMESTER_TIMELINE_STEP', semesterId: id },
        });
      }
    } else {
      const stepConfig = await this.prisma.systemConfig.findFirst({
        where: { key: 'SEMESTER_TIMELINE_STEP', semesterId: id },
      });
      if (stepConfig?.value) savedStep = Number(stepConfig.value);
    }

    return this.formatSemester(updated, savedStep);
  }

  /**
   * Cập nhật / Đồng bộ giai đoạn lộ trình đợt KLTN (1 - 5 hoặc tự động)
   */
  async setTimelineStep(id: string, step?: number, autoSync?: boolean) {
    const semester = await this.prisma.semester.findUnique({ where: { id } });
    if (!semester) {
      throw new NotFoundException(`Không tìm thấy đợt KLTN với ID: ${id}`);
    }

    if (autoSync || step === 0 || step === undefined) {
      await this.prisma.systemConfig.deleteMany({
        where: { key: 'SEMESTER_TIMELINE_STEP', semesterId: id },
      });
    } else {
      const stepVal = Number(step);
      if (stepVal < 1 || stepVal > 5) {
        throw new BadRequestException('Bước lộ trình phải nằm trong khoảng từ 1 đến 5');
      }
      const existingConfig = await this.prisma.systemConfig.findFirst({
        where: { key: 'SEMESTER_TIMELINE_STEP', semesterId: id },
      });
      if (existingConfig) {
        await this.prisma.systemConfig.update({
          where: { id: existingConfig.id },
          data: { value: String(stepVal) },
        });
      } else {
        await this.prisma.systemConfig.create({
          data: {
            key: 'SEMESTER_TIMELINE_STEP',
            semesterId: id,
            value: String(stepVal),
            description: 'Giai đoạn lộ trình hiện tại của đợt KLTN',
          },
        });
      }
    }

    return this.findById(id);
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

  /**
   * Đặt lại toàn bộ dữ liệu về trạng thái "Mới mở học kỳ" (Bước 1/5: Đăng ký đề tài)
   * Xóa sạch các nhóm, đăng ký, bài nộp, đánh giá giữa kỳ, phản biện, hội đồng và điểm số cũ.
   */
  async resetToNewSemesterState(targetSemesterId?: string) {
    const now = new Date();
    const regFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Mở từ hôm qua
    const regTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Hạn đăng ký: +30 ngày
    const subTo = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // Hạn nộp báo cáo: +60 ngày
    const defFrom = new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000); // Bảo vệ từ: +75 ngày
    const defTo = new Date(now.getTime() + 85 * 24 * 60 * 60 * 1000); // Bảo vệ đến: +85 ngày

    // 1. Xóa sạch dữ liệu giao dịch phát sinh theo đúng thứ tự khóa ngoại
    await this.prisma.$transaction([
      this.prisma.score.deleteMany({}),
      this.prisma.defenseSchedule.deleteMany({}),
      this.prisma.defenseCommitteeMember.deleteMany({}),
      this.prisma.defenseCommittee.deleteMany({}),
      this.prisma.reviewerAssignment.deleteMany({}),
      this.prisma.feedback.deleteMany({}),
      this.prisma.submission.deleteMany({}),
      this.prisma.progressReport.deleteMany({}),
      this.prisma.appointment.deleteMany({}),
      this.prisma.chatMessage.deleteMany({}),
      this.prisma.groupMember.deleteMany({}),
      this.prisma.registration.deleteMany({}),
      this.prisma.topicProposal.deleteMany({}),
      this.prisma.group.deleteMany({}),
      this.prisma.notification.deleteMany({}),
      this.prisma.auditLog.deleteMany({}),
    ]);

    // 2. Xác định hoặc khởi tạo học kỳ chính thức đang mở
    let semester = targetSemesterId
      ? await this.prisma.semester.findUnique({ where: { id: targetSemesterId } })
      : await this.prisma.semester.findFirst({
          where: { NOT: { code: { startsWith: 'SEM_DEF_' } } },
          orderBy: { createdAt: 'desc' },
        });

    const dept = await this.prisma.department.findFirst({
      where: { code: { in: ['CNTT', 'IS'] } },
    });

    if (semester) {
      semester = await this.prisma.semester.update({
        where: { id: semester.id },
        data: {
          status: SemesterStatus.OPEN,
          registrationFrom: regFrom,
          registrationTo: regTo,
          submissionTo: subTo,
          defenseFrom: defFrom,
          defenseTo: defTo,
        },
      });
    } else if (dept) {
      semester = await this.prisma.semester.create({
        data: {
          code: '2026-KLTN-1',
          name: 'Đợt KLTN học kỳ 1 năm 2026',
          academicYear: '2026-2027',
          departmentId: dept.id,
          status: SemesterStatus.OPEN,
          registrationFrom: regFrom,
          registrationTo: regTo,
          submissionTo: subTo,
          defenseFrom: defFrom,
          defenseTo: defTo,
        },
      });
    }

    if (semester) {
      // Đóng các học kỳ phụ khác nếu có
      await this.prisma.semester.updateMany({
        where: { id: { not: semester.id } },
        data: { status: SemesterStatus.CLOSED },
      });

      // 3. Xóa các đề tài rác sinh ra từ quá trình chạy test tự động (nếu có) và đặt lại 88 đề tài chuẩn về ngành IS
      const isDept = await this.prisma.department.findUnique({ where: { code: 'IS' } });
      await this.prisma.topic.deleteMany({
        where: {
          OR: [
            { title: { contains: 'Chuỗi cung ứng' } },
            { owner: { email: { startsWith: 'gv.' } } },
          ],
        },
      });
      await this.prisma.topic.updateMany({
        data: {
          semesterId: semester.id,
          ...(isDept ? { departmentId: isDept.id } : {}),
          status: 'APPROVED',
          isHidden: false,
          reviewerId: null,
          rejectionReason: null,
        },
      });

      // 4. Đặt lại hạn mức hướng dẫn của tất cả Giảng viên về mặc định 5 nhóm (đã nhận 0/5)
      await this.prisma.lecturerProfile.updateMany({
        data: { maxGroups: 5 },
      });
      const allLecturers = await this.prisma.lecturerProfile.findMany();
      for (const lec of allLecturers) {
        await this.prisma.lecturerQuota.upsert({
          where: {
            lecturerId_semesterId: {
              lecturerId: lec.id,
              semesterId: semester.id,
            },
          },
          update: { maxGroups: 5 },
          create: {
            lecturerId: lec.id,
            semesterId: semester.id,
            maxGroups: 5,
          },
        });
      }

      // 5. Đặt lại bước lộ trình học kỳ về Bước 1 (Đăng ký đề tài) & xóa cấu hình hạn mức chung để test từ đầu
      await this.prisma.systemConfig.deleteMany({
        where: {
          OR: [
            { key: 'SEMESTER_TIMELINE_STEP' },
            { key: { startsWith: 'SEMESTER_TIMELINE_STEP_' } },
            { key: 'SEMESTER_DEFAULT_QUOTA' },
            { key: { startsWith: 'SEMESTER_DEFAULT_QUOTA_' } },
          ],
        },
      });
      await this.prisma.systemConfig.create({
        data: {
          key: `SEMESTER_TIMELINE_STEP_${semester.id}`,
          value: 1,
          semesterId: semester.id,
          departmentId: semester.departmentId,
          description: 'Bước lộ trình hiện tại của đợt KLTN (Bước 1: Đăng ký đề tài)',
        },
      });
    }

    // 6. Đảm bảo có sẵn các tài khoản Sinh viên test (4 SV đủ điều kiện, 1 SV chưa đủ điều kiện)
    const studentRole = await this.prisma.role.findUnique({ where: { code: RoleCode.SINH_VIEN } });
    if (studentRole && dept) {
      const passwordHash = await bcrypt.hash('Password@123', 12);
      const testStudents = [
        { email: 'sinhvien@kltn.edu.vn', fullName: 'Nguyễn Minh Sinh', code: 'SV2026001', eligible: true, credits: 125, gpa: 3.45 },
        { email: 'sinhvien2@kltn.edu.vn', fullName: 'Trần Thị Mai', code: 'SV2026002', eligible: true, credits: 120, gpa: 3.20 },
        { email: 'sinhvien3@kltn.edu.vn', fullName: 'Lê Hoàng Nam', code: 'SV2026003', eligible: true, credits: 118, gpa: 3.10 },
        { email: 'sinhvien4@kltn.edu.vn', fullName: 'Phạm Ngọc Lan', code: 'SV2026004', eligible: true, credits: 115, gpa: 2.95 },
        { email: 'svchuadk@kltn.edu.vn', fullName: 'Vũ Văn Chưa Đủ ĐK', code: 'SV2026005', eligible: false, credits: 90, gpa: 2.10 },
      ];

      for (const st of testStudents) {
        const u = await this.prisma.user.upsert({
          where: { email: st.email },
          update: { fullName: st.fullName, status: UserStatus.ACTIVE, passwordHash },
          create: {
            email: st.email,
            fullName: st.fullName,
            passwordHash,
            status: UserStatus.ACTIVE,
          },
        });
        await this.prisma.userRole.upsert({
          where: { userId_roleId: { userId: u.id, roleId: studentRole.id } },
          update: {},
          create: { userId: u.id, roleId: studentRole.id },
        });
        await this.prisma.studentProfile.upsert({
          where: { userId: u.id },
          update: {
            studentCode: st.code,
            eligible: st.eligible,
            creditsEarned: st.credits,
            gpa: st.gpa,
          },
          create: {
            userId: u.id,
            studentCode: st.code,
            className: 'CNTT K2026',
            cohort: 2026,
            departmentId: dept.id,
            creditsEarned: st.credits,
            gpa: st.gpa,
            eligible: st.eligible,
          },
        });
      }
    }

    return {
      message: 'Đã đặt lại toàn bộ dữ liệu về trạng thái Mới mở học kỳ (Bước 1/5: Đăng ký đề tài) thành công!',
      semester: semester ? this.formatSemester(semester, 1) : null,
    };
  }
}



