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

        const currentGroups = Math.max(guidedGroupsCount, activeTopicsCount);
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

    return {
      semesterId: semester.id,
      semester: {
        id: semester.id,
        code: semester.code,
        name: semester.name,
        academicYear: semester.academicYear,
        status: semester.status,
      },
      data: result,
      items: result,
    };
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
        if (Number.isNaN(maxGroups) || maxGroups < 1) {
          throw new BadRequestException(`Hạn mức maxGroups của giảng viên ${lecturer.user?.fullName} phải lớn hơn 0`);
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

    const activeTopicsCount = await this.prisma.topic.count({
      where: {
        ownerId: lecturerUserId,
        semesterId,
        status: {
          in: ['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'PENDING_APPROVAL', 'APPROVED', 'CAN_CAP_NHAT'],
        },
      },
    });

    const currentLoad = Math.max(guidedGroupsCount, activeTopicsCount);
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
      throw new ForbiddenException(
        `Bạn đã đạt số nhóm tối đa được phép hướng dẫn trong học kỳ này (hạn mức: ${maxGroups} nhóm). Không thể tạo thêm đề tài hoặc tiếp nhận thêm sinh viên.`,
      );
    }
  }
}

