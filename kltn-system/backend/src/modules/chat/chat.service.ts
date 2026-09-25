import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto } from './dto/send-message.dto';
import { SendConversationMessageDto } from './dto/conversations.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Lấy danh sách tin nhắn theo đề tài (topicId) có phân trang & timeline
   */
  async listByTopic(userId: string, topicId: string, page = 1, limit = 20) {
    await this.assertTopicMember(userId, topicId);

    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 20));

    // Tìm các nhóm liên kết với đề tài này
    const topicGroups = await this.prisma.group.findMany({
      where: { topicId },
      select: { id: true },
    });
    const groupIds = topicGroups.map((g) => g.id);

    const whereClause = {
      OR: [
        { topicId },
        ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
      ],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.chatMessage.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              roles: { include: { role: true } },
            },
          },
        },
      }),
      this.prisma.chatMessage.count({ where: whereClause }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Gửi tin nhắn mới vào cuộc trò chuyện của đề tài (kèm tệp đính kèm)
   */
  async sendToTopic(
    userId: string,
    topicId: string,
    dto: SendConversationMessageDto,
    file?: Express.Multer.File,
  ) {
    const { topic } = await this.assertTopicMember(userId, topicId);

    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, avatarUrl: true },
    });
    if (!sender) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Tìm nhóm liên kết (nếu có)
    const activeGroup = await this.prisma.group.findFirst({
      where: { topicId, status: { not: 'CANCELLED' } },
      select: { id: true },
    });

    // Chuẩn bị danh sách attachments
    let attachments: any[] = [];
    if (dto.attachments) {
      if (Array.isArray(dto.attachments)) {
        attachments = [...dto.attachments];
      } else if (typeof dto.attachments === 'string') {
        try {
          attachments = JSON.parse(dto.attachments);
        } catch {
          attachments = [dto.attachments];
        }
      }
    }

    if (file) {
      attachments.push({
        name: file.originalname,
        url: `/uploads/${file.filename}`,
        size: file.size,
        type: file.mimetype,
      });
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        topicId,
        groupId: activeGroup?.id,
        senderId: userId,
        content: dto.content.trim(),
        attachments,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            roles: { include: { role: true } },
          },
        },
      },
    });

    // Phát sự kiện realtime qua Socket.io
    this.gateway.emitToTopic(topicId, message);
    if (activeGroup?.id) {
      this.gateway.emitToGroup(activeGroup.id, message);
    }

    // Gửi thông báo đến các thành viên khác trong cuộc trò chuyện
    await this.notifyTopicParticipants(topic, userId, sender.fullName, dto.content.trim(), message.id);

    return message;
  }

  /**
   * Tương thích ngược: Lấy tin nhắn theo groupId
   */
  async list(userId: string, groupId: string) {
    await this.assertMember(userId, groupId);
    return this.prisma.chatMessage.findMany({
      where: { groupId },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            roles: { include: { role: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  /**
   * Tương thích ngược: Gửi tin nhắn theo groupId
   */
  async send(userId: string, dto: SendMessageDto) {
    await this.assertMember(userId, dto.groupId);
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      select: { topicId: true },
    });

    const message = await this.prisma.chatMessage.create({
      data: {
        groupId: dto.groupId,
        topicId: group?.topicId,
        senderId: userId,
        content: dto.content.trim(),
      },
      include: {
        sender: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    this.gateway.emitToGroup(dto.groupId, message);
    if (group?.topicId) {
      this.gateway.emitToTopic(group.topicId, message);
    }

    return message;
  }

  /**
   * Kiểm tra quyền truy cập vào cuộc trò chuyện của đề tài
   */
  async assertTopicMember(userId: string, topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        groups: {
          include: {
            members: {
              include: {
                student: true,
              },
            },
          },
        },
        registrations: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException('Không tìm thấy đề tài');
    }

    // 1. Kiểm tra nếu là Trưởng/Quản lý bộ môn
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const isManager = userRoles.some((r) =>
      ['TRUONG_BO_MON', 'QUAN_LY_BO_MON'].includes(r.role.code),
    );
    if (isManager) {
      return { topic, role: 'MANAGER' };
    }

    // 2. GVHD sở hữu đề tài
    if (topic.ownerId === userId) {
      return { topic, role: 'OWNER' };
    }

    // 3. Giảng viên phản biện
    if (topic.reviewerId === userId) {
      return { topic, role: 'REVIEWER' };
    }

    // 4. Sinh viên thuộc đề tài
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (student) {
      const isGroupMember = topic.groups.some((g) =>
        g.members.some((m) => m.studentId === student.id),
      );
      if (isGroupMember) {
        return { topic, role: 'STUDENT_GROUP' };
      }

      const hasActiveRegistration = topic.registrations.some(
        (r) =>
          r.studentId === student.id &&
          ['APPROVED', 'CHO_XAC_NHAN', 'PENDING'].includes(r.status),
      );
      if (hasActiveRegistration) {
        return { topic, role: 'STUDENT_REGISTERED' };
      }
    }

    throw new ForbiddenException('Bạn không có quyền tham gia cuộc trò chuyện của đề tài này');
  }

  private async assertMember(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { student: true } },
        topic: { select: { ownerId: true } },
      },
    });
    if (!group) throw new BadRequestException('Không tìm thấy nhóm');
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    const isStudent = Boolean(
      student && group.members.some((member) => member.studentId === student.id),
    );
    const isLecturer = Boolean(group.topic?.ownerId === userId);
    if (!isStudent && !isLecturer) {
      throw new ForbiddenException('Bạn không thuộc không gian trao đổi này');
    }
  }

  private async notifyTopicParticipants(
    topic: any,
    senderUserId: string,
    senderName: string,
    messageContent: string,
    messageId: string,
  ) {
    const recipientIds = new Set<string>();

    // 1. GVHD
    if (topic.ownerId && topic.ownerId !== senderUserId) {
      recipientIds.add(topic.ownerId);
    }

    // 2. GVPB
    if (topic.reviewerId && topic.reviewerId !== senderUserId) {
      recipientIds.add(topic.reviewerId);
    }

    // 3. Sinh viên trong nhóm
    if (topic.groups) {
      for (const group of topic.groups) {
        for (const member of group.members) {
          if (member.student?.userId && member.student.userId !== senderUserId) {
            recipientIds.add(member.student.userId);
          }
        }
      }
    }

    // 4. Sinh viên đã đăng ký
    if (topic.registrations) {
      for (const reg of topic.registrations) {
        if (
          reg.student?.userId &&
          reg.student.userId !== senderUserId &&
          ['APPROVED', 'CHO_XAC_NHAN'].includes(reg.status)
        ) {
          recipientIds.add(reg.student.userId);
        }
      }
    }

    const shortContent =
      messageContent.length > 80 ? `${messageContent.slice(0, 80)}...` : messageContent;

    for (const recipientId of recipientIds) {
      await this.notifications.create(
        recipientId,
        `Tin nhắn mới từ ${senderName}`,
        `[${topic.title.slice(0, 40)}] ${senderName}: ${shortContent}`,
        NotificationType.CHAT,
        { topicId: topic.id, messageId },
      );
    }
  }
}
