import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MidtermStatus, NotificationType, RoleCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MidtermEvaluationDto } from './dto/midterm-evaluation.dto';

@Injectable()
export class MidtermEvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async isManager(userId: string): Promise<boolean> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return roles.some(
      ({ role }) => role.code === 'TRUONG_BO_MON' || role.code === 'QUAN_LY_BO_MON',
    );
  }

  /**
   * Lấy cấu hình khung thời gian xác nhận giữa kỳ của học kỳ
   */
  async getEvaluationWindow(semesterId?: string) {
    const now = new Date();
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    const windowConfig = await this.prisma.systemConfig.findFirst({
      where: {
        key: { in: ['MIDTERM_CONFIRMATION_WINDOW', 'MIDTERM_EVALUATION_WINDOW'] },
        ...(semesterId ? { OR: [{ semesterId }, { semesterId: null }] } : {}),
      },
      orderBy: { semesterId: 'desc' },
    });

    if (windowConfig && typeof windowConfig.value === 'object' && windowConfig.value !== null) {
      const val = windowConfig.value as any;
      if (val.from || val.start) fromDate = new Date(val.from || val.start);
      if (val.to || val.end) toDate = new Date(val.to || val.end);
    }

    if (!fromDate || !toDate) {
      const fromConfig = await this.prisma.systemConfig.findFirst({
        where: {
          key: { in: ['MIDTERM_CONFIRMATION_FROM', 'MIDTERM_EVALUATION_FROM'] },
          ...(semesterId ? { OR: [{ semesterId }, { semesterId: null }] } : {}),
        },
        orderBy: { semesterId: 'desc' },
      });
      if (fromConfig?.value) fromDate = new Date(fromConfig.value as any);

      const toConfig = await this.prisma.systemConfig.findFirst({
        where: {
          key: { in: ['MIDTERM_CONFIRMATION_TO', 'MIDTERM_EVALUATION_TO'] },
          ...(semesterId ? { OR: [{ semesterId }, { semesterId: null }] } : {}),
        },
        orderBy: { semesterId: 'desc' },
      });
      if (toConfig?.value) toDate = new Date(toConfig.value as any);
    }

    // Nếu không có cấu hình riêng, tra cứu theo mốc thời gian Semester
    if (!fromDate && !toDate && semesterId) {
      const semester = await this.prisma.semester.findUnique({ where: { id: semesterId } });
      if (semester) {
        if (semester.registrationTo) fromDate = semester.registrationTo;
        if (semester.submissionTo) toDate = semester.submissionTo;
      }
    }

    const isOpen = (!fromDate || now >= fromDate) && (!toDate || now <= toDate);

    return {
      fromDate,
      toDate,
      isOpen,
      now,
    };
  }

  /**
   * GET /midterm-evaluations/my-groups
   * Danh sách nhóm do GV hiện tại hướng dẫn kèm thông tin đề tài, thành viên và trạng thái giữa kỳ
   */
  async getMyGroups(userId: string) {
    const isManagerUser = await this.isManager(userId);

    const groups = await this.prisma.group.findMany({
      where: isManagerUser
        ? { OR: [{ topic: { ownerId: userId } }, { id: { not: '' } }] }
        : { topic: { ownerId: userId } },
      include: {
        topic: {
          include: {
            owner: { select: { id: true, fullName: true, email: true } },
          },
        },
        semester: true,
        members: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
              },
            },
          },
        },
        registrations: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
              },
            },
          },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 5,
        },
        reports: {
          orderBy: { dueAt: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    // Lấy thông tin khung thời gian cho học kỳ của nhóm đầu tiên (hoặc mặc định)
    const semesterId = groups[0]?.semesterId;
    const windowInfo = await this.getEvaluationWindow(semesterId);

    const formattedGroups = groups.map((g) => {
      let ketQuaMidterm = 'CHUA_DANH_GIA';
      if (g.midtermStatus === MidtermStatus.CONTINUE) ketQuaMidterm = 'CHO_LAM_TIEP';
      else if (g.midtermStatus === MidtermStatus.STOPPED) ketQuaMidterm = 'DUNG_DE_TAI';

      return {
        id: g.id,
        code: g.code,
        name: g.name,
        status: g.status,
        midtermStatus: g.midtermStatus,
        ketQuaMidterm,
        midtermNote: g.midtermNote,
        midtermAt: g.midtermAt,
        topic: g.topic
          ? {
              id: g.topic.id,
              title: g.topic.title,
              summary: g.topic.summary,
              capacity: g.topic.capacity,
              owner: g.topic.owner,
            }
          : null,
        semester: g.semester
          ? {
              id: g.semester.id,
              code: g.semester.code,
              name: g.semester.name,
            }
          : null,
        members: g.members.map((m) => ({
          studentId: m.studentId,
          isLeader: m.isLeader,
          joinedAt: m.joinedAt,
          studentCode: m.student.studentCode,
          creditsEarned: m.student.creditsEarned,
          gpa: m.student.gpa,
          personalEmail: m.student.personalEmail,
          address: m.student.address,
          user: m.student.user,
        })),
        registrationsCount: g.registrations.length,
        submissionsCount: g.submissions.length,
        reportsCount: g.reports.length,
      };
    });

    return {
      groups: formattedGroups,
      evaluationWindow: {
        from: windowInfo.fromDate,
        to: windowInfo.toDate,
      },
      isEvaluationWindowOpen: windowInfo.isOpen,
    };
  }

  /**
   * POST /midterm-evaluations
   * GVHD xác nhận từng SV/nhóm: "CHO_LAM_TIEP" hoặc "DUNG_DE_TAI"
   */
  async evaluate(userId: string, dto: MidtermEvaluationDto) {
    let groupId = dto.groupId;

    // 1. Resolve groupId from registrationId if provided
    if (!groupId && dto.registrationId) {
      const reg = await this.prisma.registration.findUnique({
        where: { id: dto.registrationId },
        include: { group: true },
      });
      if (!reg) {
        throw new NotFoundException('Không tìm thấy đơn đăng ký đề tài');
      }
      if (reg.groupId) {
        groupId = reg.groupId;
      } else if (reg.topicId) {
        // Tìm group liên kết với topic này trong cùng học kỳ
        const grp = await this.prisma.group.findFirst({
          where: { topicId: reg.topicId, semesterId: reg.semesterId },
        });
        if (grp) groupId = grp.id;
      }
    }

    if (!groupId) {
      throw new BadRequestException('Vui lòng cung cấp groupId hoặc registrationId hợp lệ');
    }

    // 2. Tìm nhóm và thông tin liên quan
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        topic: { select: { id: true, title: true, ownerId: true } },
        semester: true,
        members: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm sinh viên');
    }

    // 3. Kiểm tra phân quyền: Phải là GVHD của đề tài hoặc Quản lý bộ môn
    const isOwner = group.topic?.ownerId === userId;
    const isManagerUser = await this.isManager(userId);

    if (!isOwner && !isManagerUser) {
      throw new ForbiddenException('Bạn không có quyền đánh giá giữa kỳ cho nhóm này');
    }

    // 4. Kiểm tra khung thời gian cấu hình xác nhận giữa kỳ
    const windowInfo = await this.getEvaluationWindow(group.semesterId);
    const now = new Date();

    if (windowInfo.fromDate && now < windowInfo.fromDate) {
      throw new BadRequestException('Chưa đến thời gian xác nhận đánh giá giữa kỳ KLTN');
    }
    if (windowInfo.toDate && now > windowInfo.toDate) {
      throw new BadRequestException('Đã hết thời hạn xác nhận đánh giá giữa kỳ KLTN');
    }

    // 5. Chuẩn hóa kết quả đánh giá
    const isContinue = dto.ketQua === 'CHO_LAM_TIEP' || dto.ketQua === 'CONTINUE';
    const newMidtermStatus = isContinue ? MidtermStatus.CONTINUE : MidtermStatus.STOPPED;
    const evaluationTime = new Date();

    // 6. Cập nhật trạng thái Group
    const updatedGroup = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        midtermStatus: newMidtermStatus,
        midtermNote: dto.lyDo || null,
        midtermAt: evaluationTime,
      },
      include: {
        topic: true,
        members: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
      },
    });

    // 7. Cập nhật trạng thái Registration liên quan
    const decisionNoteText =
      dto.lyDo ||
      (isContinue ? 'Xác nhận giữa kỳ: CHO LÀM TIẾP' : 'Xác nhận giữa kỳ: DỪNG ĐỀ TÀI');

    await this.prisma.registration.updateMany({
      where: {
        OR: [
          { groupId: group.id },
          ...(dto.registrationId ? [{ id: dto.registrationId }] : []),
          ...(group.topicId ? [{ topicId: group.topicId, semesterId: group.semesterId }] : []),
        ],
      },
      data: {
        decisionNote: decisionNoteText,
        decidedAt: evaluationTime,
      },
    });

    // 8. Ghi nhận Audit Log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'MIDTERM_EVALUATION',
        entity: 'Group',
        entityId: group.id,
        metadata: {
          ketQua: dto.ketQua,
          midtermStatus: newMidtermStatus,
          lyDo: dto.lyDo,
          confirmedBy: userId,
          midtermAt: evaluationTime,
        },
      },
    });

    const topicTitle = group.topic?.title || group.name;
    const resultLabel = isContinue ? 'CHO LÀM TIẾP' : 'DỪNG ĐỀ TÀI';
    const noteSuffix = dto.lyDo ? ` Lý do/Ghi chú: ${dto.lyDo}` : '';

    // 9. Gửi thông báo cho toàn bộ sinh viên trong nhóm
    for (const member of group.members) {
      const studentUserId = member.student?.userId || member.student?.user?.id;
      if (studentUserId) {
        await this.notifications.create({
          userId: studentUserId,
          title: 'Kết quả đánh giá giữa kỳ Khóa luận tốt nghiệp',
          content: `Đề tài "${topicTitle}" của bạn đã được GVHD đánh giá giữa kỳ: ${resultLabel}.${noteSuffix}`,
          type: NotificationType.FEEDBACK,
          data: {
            groupId: group.id,
            midtermStatus: newMidtermStatus,
            ketQua: dto.ketQua,
            lyDo: dto.lyDo,
          },
          sendEmail: true,
        });
      }
    }

    // 10. Gửi thông báo cho Ban quản lý bộ môn (TRUONG_BO_MON, QUAN_LY_BO_MON)
    const gvUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    });
    const gvName = gvUser?.fullName || 'Giảng viên hướng dẫn';

    const managers = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: { code: { in: ['TRUONG_BO_MON', 'QUAN_LY_BO_MON'] } },
          },
        },
      },
      select: { id: true, email: true },
    });

    for (const manager of managers) {
      if (manager.id !== userId) {
        await this.notifications.create({
          userId: manager.id,
          title: 'Cập nhật đánh giá giữa kỳ đề tài KLTN',
          content: `GVHD ${gvName} đã xác nhận kết quả giữa kỳ cho nhóm "${group.name}" (Đề tài: "${topicTitle}"): ${resultLabel}.${noteSuffix}`,
          type: NotificationType.FEEDBACK,
          data: {
            groupId: group.id,
            midtermStatus: newMidtermStatus,
            ketQua: dto.ketQua,
            evaluatorId: userId,
            lyDo: dto.lyDo,
          },
          sendEmail: false,
        });
      }
    }

    return {
      message: `Đã xác nhận đánh giá giữa kỳ: ${resultLabel}`,
      groupId: group.id,
      midtermStatus: newMidtermStatus,
      ketQua: dto.ketQua,
      midtermNote: dto.lyDo || null,
      midtermAt: evaluationTime,
      confirmedBy: userId,
      group: updatedGroup,
    };
  }
}
