import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSemesterQuotasDto } from './dto/update-semester-quotas.dto';

@Injectable()
export class QuotasService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuotas(semesterId?: string) {
    const semester = semesterId
      ? await this.prisma.semester.findUnique({ where: { id: semesterId } })
      : (await this.prisma.semester.findFirst({
          where: {
            status: 'OPEN',
            NOT: { code: { startsWith: 'SEM_DEF_' } },
          },
          orderBy: { createdAt: 'desc' },
        })) ??
        (await this.prisma.semester.findFirst({
          where: { status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
        })) ??
        (await this.prisma.semester.findFirst({
          orderBy: { createdAt: 'desc' },
        }));

    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    const lecturers = await this.prisma.lecturerProfile.findMany({
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        quotas: {
          where: { semesterId: semester.id },
        },
      },
      orderBy: [{ user: { fullName: 'asc' } }],
    });

    // Compute realtime workload for each lecturer in this semester
    const result = await Promise.all(
      lecturers.map(async (l) => {
        const guidedGroupsCount = await this.prisma.group.count({
          where: {
            topic: { ownerId: l.userId },
            semesterId: semester.id,
            status: { not: 'CANCELLED' },
          },
        });

        const activeTopicsCount = await this.prisma.topic.count({
          where: {
            ownerId: l.userId,
            semesterId: semester.id,
            status: {
              in: ['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'PENDING_APPROVAL', 'APPROVED', 'CAN_CAP_NHAT'],
            },
          },
        });

        const chosenTopicsCount = await this.prisma.topic.count({
          where: {
            ownerId: l.userId,
            semesterId: semester.id,
            status: {
              in: ['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'PENDING_APPROVAL', 'APPROVED', 'CAN_CAP_NHAT'],
            },
            OR: [
              { groups: { some: { status: { not: 'CANCELLED' } } } },
              { registrations: { some: { status: { in: ['PENDING', 'CHO_XAC_NHAN', 'APPROVED'] } } } },
            ],
          },
        });

        const currentGroups = Math.max(guidedGroupsCount, chosenTopicsCount);
        const maxGroups = l.quotas[0]?.maxGroups ?? l.maxGroups ?? 5;
        const remainingSlots = Math.max(0, maxGroups - currentGroups);
        const isOverloaded = currentGroups >= maxGroups;

        return {
          id: l.id,
          lecturerId: l.id,
          userId: l.userId,
          lecturerCode: l.lecturerCode,
          fullName: l.user?.fullName || '',
          hoTen: l.user?.fullName || '',
          email: l.user?.email || '',
          phone: l.user?.phone || 'Chưa cập nhật',
          title: l.title || 'Giảng viên',
          hocHamHocVi: l.title || 'Giảng viên',
          departmentId: l.departmentId,
          department: l.department,
          boMon: l.department?.name || '',
          maxGroups,
          hanMuc: maxGroups,
          currentGroups,
          soNhomHienTai: currentGroups,
          guidedGroupsCount,
          activeTopicsCount,
          remainingSlots,
          soChoConLai: remainingSlots,
          isOverloaded,
          daDatToiDa: isOverloaded,
          semesterId: semester.id,
        };
      }),
    );

    const stepConfig = await this.prisma.systemConfig.findFirst({
      where: {
        OR: [
          { key: 'SEMESTER_TIMELINE_STEP', semesterId: semester.id },
          { key: `SEMESTER_TIMELINE_STEP_${semester.id}` },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    const defaultQuotaConfig = await this.prisma.systemConfig.findFirst({
      where: {
        OR: [
          { key: 'SEMESTER_DEFAULT_QUOTA', semesterId: semester.id },
          { key: `SEMESTER_DEFAULT_QUOTA_${semester.id}` },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
    const semesterDefaultQuota =
      defaultQuotaConfig?.value !== undefined && defaultQuotaConfig?.value !== null
        ? Number(defaultQuotaConfig.value)
        : null;
    const hasSemesterDefaultQuota =
      semesterDefaultQuota !== null && !Number.isNaN(semesterDefaultQuota);

    const enrichedResult = result.map((item) => ({
      ...item,
      isCustomQuota: hasSemesterDefaultQuota ? item.maxGroups !== semesterDefaultQuota : false,
      semesterDefaultQuota,
      hasSemesterDefaultQuota,
    }));

    return {
      semesterId: semester.id,
      hasSemesterDefaultQuota,
      semesterDefaultQuota,
      semester: {
        id: semester.id,
        code: semester.code,
        name: semester.name,
        academicYear: semester.academicYear,
        status: semester.status,
        registrationFrom: semester.registrationFrom,
        registrationTo: semester.registrationTo,
        submissionTo: semester.submissionTo,
        defenseFrom: semester.defenseFrom,
        defenseTo: semester.defenseTo,
        currentStep: stepConfig?.value ? Number(stepConfig.value) : undefined,
        hasSemesterDefaultQuota,
        semesterDefaultQuota,
      },
      data: enrichedResult,
      items: enrichedResult,
    };
  }

  async setSemesterBulkQuota(
    body: { semesterId?: string; maxGroups: number },
    updatedByUserId?: string,
  ) {
    const semester = body.semesterId
      ? await this.prisma.semester.findUnique({ where: { id: body.semesterId } })
      : await this.prisma.semester.findFirst({
          where: { status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
        });

    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ để thiết lập hạn mức chung');
    }

    const maxGroups = Number(body.maxGroups);
    if (Number.isNaN(maxGroups) || !Number.isInteger(maxGroups) || maxGroups < 0 || maxGroups > 50) {
      throw new BadRequestException('Hạn mức chung cho học kỳ phải là số nguyên từ 0 đến 50');
    }

    const lecturers = await this.prisma.lecturerProfile.findMany({
      include: { user: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const updatedList: any[] = [];

      for (const lecturer of lecturers) {
        const activeGuidedGroups = await tx.group.count({
          where: {
            topic: { ownerId: lecturer.userId },
            semesterId: semester.id,
            status: { not: 'CANCELLED' },
          },
        });

        const appliedQuota = Math.max(maxGroups, activeGuidedGroups);

        const updatedQuota = await tx.lecturerQuota.upsert({
          where: {
            lecturerId_semesterId: {
              lecturerId: lecturer.id,
              semesterId: semester.id,
            },
          },
          update: { maxGroups: appliedQuota },
          create: {
            lecturerId: lecturer.id,
            semesterId: semester.id,
            maxGroups: appliedQuota,
          },
        });

        if (semester.status === 'OPEN') {
          await tx.lecturerProfile.update({
            where: { id: lecturer.id },
            data: { maxGroups: appliedQuota },
          });
        }

        updatedList.push({
          lecturerId: lecturer.id,
          lecturerName: lecturer.user?.fullName,
          maxGroups: updatedQuota.maxGroups,
        });
      }

      // Lưu cấu hình SEMESTER_DEFAULT_QUOTA đánh dấu đã thiết lập hạn mức chung cho học kỳ
      const existingConfig = await tx.systemConfig.findFirst({
        where: {
          OR: [
            { key: 'SEMESTER_DEFAULT_QUOTA', semesterId: semester.id },
            { key: `SEMESTER_DEFAULT_QUOTA_${semester.id}` },
          ],
        },
      });
      if (existingConfig) {
        await tx.systemConfig.update({
          where: { id: existingConfig.id },
          data: { value: String(maxGroups) },
        });
      } else {
        await tx.systemConfig.create({
          data: {
            key: 'SEMESTER_DEFAULT_QUOTA',
            value: String(maxGroups),
            semesterId: semester.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: updatedByUserId || null,
          action: 'SET_SEMESTER_DEFAULT_QUOTA',
          entity: 'Semester',
          entityId: semester.id,
          metadata: {
            semesterId: semester.id,
            semesterName: semester.name,
            defaultMaxGroups: maxGroups,
            updatedCount: updatedList.length,
          },
        },
      });

      return {
        semesterId: semester.id,
        semesterName: semester.name,
        hasSemesterDefaultQuota: true,
        semesterDefaultQuota: maxGroups,
        updatedCount: updatedList.length,
        quotas: updatedList,
        message: `Đã thiết lập hạn mức chung (${maxGroups} nhóm) cho toàn bộ ${updatedList.length} giảng viên trong học kỳ ${semester.name}. Bây giờ bạn có thể điều chỉnh riêng cho từng giảng viên nếu có nhu cầu.`,
      };
    });
  }

  async updateQuotas(dto: UpdateSemesterQuotasDto, updatedByUserId?: string) {
    const semester = await this.prisma.semester.findUnique({
      where: { id: dto.semesterId },
    });

    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ với ID đã cho');
    }

    if (!dto.quotas || !Array.isArray(dto.quotas) || dto.quotas.length === 0) {
      throw new BadRequestException('Danh sách hạn mức không được để trống');
    }

    // Kiểm tra xem học kỳ đã được thiết lập hạn mức chung cho toàn bộ GV chưa
    const defaultQuotaConfig = await this.prisma.systemConfig.findFirst({
      where: {
        OR: [
          { key: 'SEMESTER_DEFAULT_QUOTA', semesterId: semester.id },
          { key: `SEMESTER_DEFAULT_QUOTA_${semester.id}` },
        ],
      },
    });

    if (dto.quotas.length === 1 && !defaultQuotaConfig) {
      throw new BadRequestException(
        'Vui lòng thiết lập hạn mức chung cho toàn bộ giảng viên trong học kỳ trước, sau đó mới điều chỉnh riêng cho từng giảng viên.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedList: any[] = [];

      for (const item of dto.quotas) {
        const lecturer = await tx.lecturerProfile.findFirst({
          where: {
            OR: [{ id: item.lecturerId }, { userId: item.lecturerId }],
          },
          include: { user: true },
        });

        if (!lecturer) {
          throw new NotFoundException(`Không tìm thấy thông tin giảng viên: ${item.lecturerId}`);
        }

        const maxGroups = Number(item.maxGroups);
        if (Number.isNaN(maxGroups) || maxGroups < 0) {
          throw new BadRequestException(
            `Hạn mức maxGroups của giảng viên ${lecturer.user?.fullName} không được là số âm (phải >= 0)`,
          );
        }

        const activeGuidedGroups = await tx.group.count({
          where: {
            topic: { ownerId: lecturer.userId },
            semesterId: semester.id,
            status: { not: 'CANCELLED' },
          },
        });

        if (maxGroups < activeGuidedGroups) {
          throw new BadRequestException(
            `Không thể đặt hạn mức (${maxGroups}) thấp hơn số nhóm giảng viên ${lecturer.user?.fullName} đang hướng dẫn thực tế (${activeGuidedGroups} nhóm)`,
          );
        }

        const updatedQuota = await tx.lecturerQuota.upsert({
          where: {
            lecturerId_semesterId: {
              lecturerId: lecturer.id,
              semesterId: semester.id,
            },
          },
          update: {
            maxGroups,
          },
          create: {
            lecturerId: lecturer.id,
            semesterId: semester.id,
            maxGroups,
          },
        });

        // Sync default maxGroups in LecturerProfile if semester is OPEN
        if (semester.status === 'OPEN') {
          await tx.lecturerProfile.update({
            where: { id: lecturer.id },
            data: { maxGroups },
          });
        }

        updatedList.push({
          lecturerId: lecturer.id,
          lecturerName: lecturer.user?.fullName,
          maxGroups: updatedQuota.maxGroups,
        });
      }

      if (dto.quotas.length > 1 && !defaultQuotaConfig) {
        await tx.systemConfig.create({
          data: {
            key: 'SEMESTER_DEFAULT_QUOTA',
            value: String(dto.quotas[0].maxGroups ?? 5),
            semesterId: semester.id,
          },
        });
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: updatedByUserId || null,
          action: 'UPDATE_SEMESTER_QUOTAS',
          entity: 'Semester',
          entityId: semester.id,
          metadata: {
            semesterId: semester.id,
            semesterName: semester.name,
            semesterCode: semester.code,
            updatedCount: updatedList.length,
            quotas: updatedList,
          },
        },
      });

      return {
        semesterId: semester.id,
        semesterName: semester.name,
        updatedCount: updatedList.length,
        quotas: updatedList,
        message: 'Cập nhật hạn mức hướng dẫn theo học kỳ thành công',
      };
    });
  }

  async getLecturerQuota(lecturerIdOrUserId: string, semesterId: string): Promise<number> {
    const lecturer = await this.prisma.lecturerProfile.findFirst({
      where: {
        OR: [{ id: lecturerIdOrUserId }, { userId: lecturerIdOrUserId }],
      },
      include: {
        quotas: {
          where: { semesterId },
        },
      },
    });

    if (!lecturer) return 5;
    return lecturer.quotas[0]?.maxGroups ?? lecturer.maxGroups ?? 5;
  }

  async checkQuotaRealtime(lecturerUserId: string, semesterId: string) {
    const lecturer = await this.prisma.lecturerProfile.findUnique({
      where: { userId: lecturerUserId },
      include: {
        quotas: {
          where: { semesterId },
        },
      },
    });

    const maxGroups = lecturer?.quotas[0]?.maxGroups ?? lecturer?.maxGroups ?? 5;

    const guidedGroupsCount = await this.prisma.group.count({
      where: {
        topic: { ownerId: lecturerUserId },
        semesterId,
        status: { not: 'CANCELLED' },
      },
    });

    const chosenTopicsCount = await this.prisma.topic.count({
      where: {
        ownerId: lecturerUserId,
        semesterId,
        status: {
          in: ['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'PENDING_APPROVAL', 'APPROVED', 'CAN_CAP_NHAT'],
        },
        OR: [
          { groups: { some: { status: { not: 'CANCELLED' } } } },
          { registrations: { some: { status: { in: ['PENDING', 'CHO_XAC_NHAN', 'APPROVED'] } } } },
        ],
      },
    });

    const currentLoad = Math.max(guidedGroupsCount, chosenTopicsCount);
    const allowed = currentLoad < maxGroups;

    return {
      allowed,
      currentLoad,
      maxGroups,
      remainingSlots: Math.max(0, maxGroups - currentLoad),
    };
  }

  async assertCanGuideMore(lecturerUserId: string, semesterId: string) {
    const { allowed, currentLoad, maxGroups } = await this.checkQuotaRealtime(lecturerUserId, semesterId);
    if (!allowed) {
      if (maxGroups <= 0) {
        throw new ForbiddenException(
          'Hạn mức hướng dẫn của giảng viên trong học kỳ này là 0 nhóm. Không thể tạo đề tài hoặc tiếp nhận sinh viên.',
        );
      }
      throw new ForbiddenException(
        `Bạn đã đạt số nhóm tối đa được phép hướng dẫn trong học kỳ này (${currentLoad}/${maxGroups} nhóm). Không thể tạo thêm đề tài hoặc tiếp nhận thêm sinh viên.`,
      );
    }
  }
}

