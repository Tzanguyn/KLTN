import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { EmailService } from './email.service';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  content?: string;
  message?: string;
  type?: NotificationType;
  data?: any;
  sendEmail?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly emailService: EmailService,
  ) {}

  private formatNotification(item: any) {
    const text = item.content || item.message || '';
    return {
      id: item.id,
      userId: item.userId,
      type: item.type,
      title: item.title,
      content: text,
      message: text,
      data: item.data,
      isRead: item.isRead ?? !!item.readAt,
      readAt: item.readAt,
      createdAt: item.createdAt,
    };
  }

  async list(userId: string, page = 1, limit = 25, type?: NotificationType) {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 25));

    const where: any = { userId };
    if (type) {
      where.type = type;
    }

    const [rawItems, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    const items = rawItems.map((item) => this.formatNotification(item));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount,
      },
    };
  }

  async markRead(userId: string, id: string) {
    const item = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Không tìm thấy thông báo');

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return this.formatNotification(updated);
  }

  async markReadAll(userId: string) {
    const now = new Date();
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: now },
    });

    return {
      updatedCount: result.count,
    };
  }

  async create(
    userIdOrParams: string | CreateNotificationParams,
    titleArg?: string,
    messageOrContentArg?: string,
    typeArg: NotificationType = 'SYSTEM',
    dataArg?: any,
    sendEmailArg: boolean = false,
  ) {
    let userId: string;
    let title: string;
    let text: string;
    let type: NotificationType = 'SYSTEM';
    let data: any = undefined;
    let sendEmail: boolean = false;

    if (typeof userIdOrParams === 'object') {
      userId = userIdOrParams.userId;
      title = userIdOrParams.title;
      text = userIdOrParams.content || userIdOrParams.message || '';
      type = userIdOrParams.type ?? 'SYSTEM';
      data = userIdOrParams.data;
      sendEmail = userIdOrParams.sendEmail ?? false;
    } else {
      userId = userIdOrParams;
      title = titleArg || '';
      text = messageOrContentArg || '';
      type = typeArg;
      data = dataArg;
      sendEmail = sendEmailArg;
    }

    const item = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message: text,
        content: text,
        type,
        isRead: false,
        readAt: null,
        ...(data !== undefined ? { data } : {}),
      },
    });

    const formatted = this.formatNotification(item);

    // 1. Push Realtime qua Socket.io room user:${userId}
    this.gateway.emitToUser(userId, formatted);

    // 2. Gửi email thông báo (nếu được yêu cầu hoặc là các sự kiện quan trọng)
    if (sendEmail) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, fullName: true },
        });
        if (user?.email) {
          await this.emailService.sendNotificationEmail(user.email, title, text, {
            userId,
            notificationId: item.id,
            type,
            data,
          });
        }
      } catch (e) {
        // Không để lỗi gửi email làm gián đoạn luồng chính
      }
    }

    return formatted;
  }

  /**
   * Quét và gửi cảnh báo deadline còn 3 - 7 ngày cho sinh viên
   * - Hạn nộp báo cáo tiến độ (ProgressReport)
   * - Lịch bảo vệ Khóa luận tốt nghiệp (DefenseSchedule)
   */
  async checkAndSendDeadlineWarnings(): Promise<{
    reportsChecked: number;
    schedulesChecked: number;
    notificationsSent: number;
  }> {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let notificationsSent = 0;

    // 1. Quét báo cáo tiến độ sắp đến hạn (trong vòng 7 ngày)
    const upcomingReports = await this.prisma.progressReport.findMany({
      where: {
        dueAt: {
          gt: now,
          lte: in7Days,
        },
      },
      include: {
        group: {
          include: {
            topic: true,
            members: { include: { student: { include: { user: true } } } },
          },
        },
        submissions: true,
      },
    });

    for (const report of upcomingReports) {
      if (!report.dueAt) continue;
      const diffMs = report.dueAt.getTime() - now.getTime();
      const remainingDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      // Chỉ cảnh báo khi còn từ 1 đến 7 ngày (đặc biệt 3-7 ngày)
      if (remainingDays > 7) continue;

      const groupMembers = report.group?.members ?? [];
      const topicTitle = report.group?.topic?.title || report.group?.name || 'Đề tài KLTN';

      for (const member of groupMembers) {
        const studentUser = member.student?.user;
        if (!studentUser) continue;

        // Kiểm tra xem nhóm đã nộp bài cho mốc này chưa
        const alreadySubmitted = report.submissions?.some(
          (s) => s.groupId === report.groupId || s.submittedBy === studentUser.id,
        );
        if (alreadySubmitted) continue;

        // Tránh spam thông báo deadline trùng lặp trong vòng 24 giờ
        const recentNotif = await this.prisma.notification.findFirst({
          where: {
            userId: studentUser.id,
            type: 'DEADLINE',
            createdAt: { gte: oneDayAgo },
            data: {
              path: ['reportId'],
              equals: report.id,
            },
          },
        });

        if (!recentNotif) {
          await this.create({
            userId: studentUser.id,
            type: 'DEADLINE',
            title: `Cảnh báo deadline: Còn ${remainingDays} ngày nộp báo cáo KLTN`,
            content: `Báo cáo "${report.title}" của đề tài "${topicTitle}" còn ${remainingDays} ngày nữa là đến hạn (${report.dueAt.toLocaleDateString('vi-VN')}). Vui lòng nộp bài đúng hạn.`,
            data: {
              reportId: report.id,
              groupId: report.groupId,
              dueAt: report.dueAt.toISOString(),
              remainingDays,
            },
            sendEmail: true,
          });
          notificationsSent++;
        }
      }
    }

    // 2. Quét lịch bảo vệ KLTN sắp diễn ra (trong vòng 7 ngày)
    const upcomingSchedules = await this.prisma.defenseSchedule.findMany({
      where: {
        startsAt: {
          gt: now,
          lte: in7Days,
        },
        status: { in: ['SCHEDULED', 'DRAFT'] },
      },
      include: {
        group: {
          include: {
            topic: true,
            members: { include: { student: { include: { user: true } } } },
          },
        },
      },
    });

    for (const schedule of upcomingSchedules) {
      const diffMs = schedule.startsAt.getTime() - now.getTime();
      const remainingDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const groupMembers = schedule.group?.members ?? [];
      const topicTitle = schedule.group?.topic?.title || schedule.group?.name || 'Đề tài KLTN';

      for (const member of groupMembers) {
        const studentUser = member.student?.user;
        if (!studentUser) continue;

        const recentNotif = await this.prisma.notification.findFirst({
          where: {
            userId: studentUser.id,
            type: 'DEADLINE',
            createdAt: { gte: oneDayAgo },
            data: {
              path: ['scheduleId'],
              equals: schedule.id,
            },
          },
        });

        if (!recentNotif) {
          await this.create({
            userId: studentUser.id,
            type: 'DEADLINE',
            title: `Nhắc nhở: Lịch bảo vệ KLTN còn ${remainingDays} ngày`,
            content: `Phiên bảo vệ Khóa luận tốt nghiệp của đề tài "${topicTitle}" sẽ diễn ra vào ${schedule.startsAt.toLocaleString('vi-VN')} tại phòng ${schedule.room || 'Hội đồng'}.`,
            data: {
              scheduleId: schedule.id,
              groupId: schedule.groupId,
              startsAt: schedule.startsAt.toISOString(),
              remainingDays,
            },
            sendEmail: true,
          });
          notificationsSent++;
        }
      }
    }

    return {
      reportsChecked: upcomingReports.length,
      schedulesChecked: upcomingSchedules.length,
      notificationsSent,
    };
  }
}
