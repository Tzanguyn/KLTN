import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentMode, AppointmentStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ProposeTimeDto } from './dto/propose-time.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string, query?: QueryAppointmentDto) {
    return this.getMy(userId, query);
  }

  async getMy(userId: string, query?: QueryAppointmentDto) {
    const baseOr: any[] = [
      { hostId: userId },
      { guestId: userId },
      {
        group: {
          members: {
            some: {
              student: {
                userId,
              },
            },
          },
        },
      },
    ];

    const where: any = { OR: baseOr };

    if (query?.status) {
      where.status = query.status;
    }

    const mode = query?.hinhThuc || query?.mode;
    if (mode) {
      where.mode = mode as AppointmentMode;
    }

    if (query?.groupId) {
      where.groupId = query.groupId;
    }

    const start = query?.from || query?.startDate;
    const end = query?.to || query?.endDate;
    if (start || end) {
      where.startsAt = {};
      if (start) {
        const sDate = new Date(start);
        if (!isNaN(sDate.getTime())) {
          where.startsAt.gte = sDate;
        }
      }
      if (end) {
        const eDate = new Date(end);
        if (!isNaN(eDate.getTime())) {
          if (end.length === 10) {
            eDate.setHours(23, 59, 59, 999);
          }
          where.startsAt.lte = eDate;
        }
      }
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: {
        group: {
          include: {
            topic: {
              select: { id: true, title: true },
            },
            members: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { id: true, fullName: true, email: true, avatarUrl: true },
                    },
                  },
                },
              },
            },
          },
        },
        host: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
        guest: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
        proposedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async create(userId: string, dto: CreateAppointmentDto) {
    // 1. Phân giải thời gian bắt đầu & kết thúc
    const rawStartsAt = dto.thoiGianBatDau || dto.startsAt;
    const rawEndsAt = dto.thoiGianKetThuc || dto.endsAt;

    if (!rawStartsAt || !rawEndsAt) {
      throw new BadRequestException('Vui lòng cung cấp thời gian bắt đầu và kết thúc cuộc hẹn');
    }

    const startsAt = new Date(rawStartsAt);
    const endsAt = new Date(rawEndsAt);

    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
      throw new BadRequestException('Thời gian cuộc hẹn không đúng định dạng');
    }

    if (endsAt <= startsAt) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }

    // 2. Phân giải hình thức & địa điểm/link
    const mode = ((dto.hinhThuc || dto.mode || AppointmentMode.ONLINE) as string).toUpperCase() ===
    'OFFLINE'
      ? AppointmentMode.OFFLINE
      : AppointmentMode.ONLINE;

    const location = dto.phong || dto.location || undefined;
    const meetingUrl = dto.linkMeet || dto.meetingUrl || undefined;

    // 3. Phân giải tiêu đề & nội dung
    let title = dto.title?.trim() || dto.noiDung?.trim();
    if (!title) {
      title = 'Cuộc hẹn trao đổi KLTN';
    }
    let description = dto.description?.trim();
    if (!description && dto.noiDung && dto.title && dto.noiDung !== dto.title) {
      description = dto.noiDung.trim();
    }

    // 4. Phân giải nhóm (qua groupId hoặc studentIds)
    let targetGroupId = dto.groupId;
    let targetGroup: any = null;
    let targetGuestId = dto.guestId;

    const studentUserIdsToNotify = new Set<string>();

    if (targetGroupId) {
      targetGroup = await this.prisma.group.findUnique({
        where: { id: targetGroupId },
        include: {
          members: {
            include: {
              student: {
                include: { user: true },
              },
            },
          },
          topic: true,
        },
      });

      if (!targetGroup) {
        throw new NotFoundException('Không tìm thấy nhóm KLTN');
      }
    } else if (dto.studentIds && dto.studentIds.length > 0) {
      // Tìm sinh viên theo studentProfile.id hoặc user.id
      const students = await this.prisma.studentProfile.findMany({
        where: {
          OR: [
            { id: { in: dto.studentIds } },
            { userId: { in: dto.studentIds } },
          ],
        },
        include: {
          user: true,
          groupMembers: {
            include: {
              group: {
                include: {
                  topic: true,
                  members: {
                    include: {
                      student: { include: { user: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      for (const s of students) {
        studentUserIdsToNotify.add(s.userId);
      }

      if (students.length === 1) {
        targetGuestId = students[0].userId;
      }

      // Ưu tiên 1: Nhóm có đề tài do giảng viên (userId) hướng dẫn
      for (const student of students) {
        for (const gm of student.groupMembers) {
          if (gm.group?.topic?.ownerId === userId && gm.group.status !== 'CANCELLED') {
            targetGroup = gm.group;
            targetGroupId = targetGroup.id;
            break;
          }
        }
        if (targetGroup) break;
      }

      // Ưu tiên 2: Nhóm đang hoạt động của sinh viên
      if (!targetGroup) {
        for (const student of students) {
          const activeGm = student.groupMembers.find((gm) => gm.group?.status !== 'CANCELLED');
          if (activeGm) {
            targetGroup = activeGm.group;
            targetGroupId = targetGroup.id;
            break;
          }
        }
      }

      // Ưu tiên 3: Tìm nhóm qua bảng đăng ký đề tài (registration)
      if (!targetGroup) {
        const studentProfileIds = students.map((s) => s.id);
        const registration = await this.prisma.registration.findFirst({
          where: {
            studentId: { in: studentProfileIds },
            status: { in: ['APPROVED', 'CHO_XAC_NHAN', 'PENDING'] },
          },
          include: {
            group: {
              include: {
                topic: true,
                members: { include: { student: { include: { user: true } } } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (registration?.group) {
          targetGroup = registration.group;
          targetGroupId = targetGroup.id;
        }
      }

      // Ưu tiên 4: Tạo nhóm tạm thời cho buổi hẹn nếu sinh viên chưa có nhóm
      if (!targetGroup && students.length > 0) {
        const semester = await this.prisma.semester.findFirst({
          orderBy: { createdAt: 'desc' },
        });

        if (!semester) {
          throw new BadRequestException('Chưa có học kỳ nào để khởi tạo nhóm cho cuộc hẹn');
        }

        const studentNames = students.map((s) => s.user.fullName).join(', ');
        targetGroup = await this.prisma.group.create({
          data: {
            code: `GRP-${Date.now().toString().slice(-6)}`,
            name: `Nhóm ${studentNames.slice(0, 50)}`,
            status: 'ACTIVE',
            semesterId: semester.id,
          },
          include: {
            topic: true,
            members: { include: { student: { include: { user: true } } } },
          },
        });

        for (const s of students) {
          await this.prisma.groupMember.create({
            data: {
              groupId: targetGroup.id,
              studentId: s.id,
              isLeader: true,
            },
          });
        }
        targetGroupId = targetGroup.id;
      }
    }

    if (!targetGroupId || !targetGroup) {
      throw new BadRequestException('Vui lòng cung cấp groupId hoặc studentIds hợp lệ');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        groupId: targetGroupId,
        hostId: userId,
        guestId: targetGuestId,
        title,
        description,
        mode,
        location,
        meetingUrl,
        startsAt,
        endsAt,
        allowProposeTime: dto.allowProposeTime !== undefined ? dto.allowProposeTime : true,
        status: AppointmentStatus.PROPOSED,
      },
      include: {
        group: {
          include: {
            topic: true,
            members: {
              include: {
                student: { include: { user: true } },
              },
            },
          },
        },
        host: { select: { id: true, fullName: true, email: true } },
        guest: { select: { id: true, fullName: true, email: true } },
      },
    });

    // 5. Gửi thông báo cho SV khi tạo
    const recipientIds = new Set<string>();
    if (targetGuestId && targetGuestId !== userId) {
      recipientIds.add(targetGuestId);
    }
    for (const uid of studentUserIdsToNotify) {
      if (uid !== userId) recipientIds.add(uid);
    }
    for (const member of targetGroup.members || []) {
      if (member.student?.userId && member.student.userId !== userId) {
        recipientIds.add(member.student.userId);
      }
    }

    const hostName = appointment.host?.fullName || 'Giảng viên';
    const modeText = mode === AppointmentMode.ONLINE ? 'Trực tuyến' : 'Trực tiếp';
    const locationText = location ? ` tại phòng ${location}` : '';
    const meetText = meetingUrl ? ` (${meetingUrl})` : '';

    for (const recipientId of recipientIds) {
      await this.notifications.create(
        recipientId,
        'Lịch hẹn mới',
        `${hostName} đã tạo lịch hẹn mới: "${title}" vào lúc ${startsAt.toLocaleString('vi-VN')} (${modeText}${locationText}${meetText}).`,
        NotificationType.APPOINTMENT,
        {
          appointmentId: appointment.id,
          startsAt: startsAt.toISOString(),
          mode,
          title,
        },
        true,
      );
    }

    return appointment;
  }

  async update(userId: string, id: string, dto: UpdateAppointmentDto) {
    const appointment = await this.findAndAuthorizeAppointment(userId, id);

    const rawStartsAt = dto.thoiGianBatDau || dto.startsAt;
    const rawEndsAt = dto.thoiGianKetThuc || dto.endsAt;

    let startsAt = appointment.startsAt;
    let endsAt = appointment.endsAt;

    if (rawStartsAt) {
      const s = new Date(rawStartsAt);
      if (isNaN(s.getTime())) throw new BadRequestException('Thời gian bắt đầu không hợp lệ');
      startsAt = s;
    }

    if (rawEndsAt) {
      const e = new Date(rawEndsAt);
      if (isNaN(e.getTime())) throw new BadRequestException('Thời gian kết thúc không hợp lệ');
      endsAt = e;
    }

    if (endsAt <= startsAt) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }

    const mode = dto.hinhThuc
      ? (dto.hinhThuc.toUpperCase() === 'OFFLINE' ? AppointmentMode.OFFLINE : AppointmentMode.ONLINE)
      : dto.mode;

    const location = dto.phong !== undefined ? dto.phong : dto.location;
    const meetingUrl = dto.linkMeet !== undefined ? dto.linkMeet : dto.meetingUrl;
    const title = dto.title?.trim() || dto.noiDung?.trim();
    const description = dto.description !== undefined ? dto.description.trim() : undefined;

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(mode ? { mode } : {}),
        ...(rawStartsAt ? { startsAt } : {}),
        ...(rawEndsAt ? { endsAt } : {}),
        ...(location !== undefined ? { location } : {}),
        ...(meetingUrl !== undefined ? { meetingUrl } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.allowProposeTime !== undefined ? { allowProposeTime: dto.allowProposeTime } : {}),
        ...(dto.guestId !== undefined ? { guestId: dto.guestId } : {}),
      },
      include: {
        group: {
          include: {
            members: {
              include: {
                student: { include: { user: true } },
              },
            },
          },
        },
        host: { select: { id: true, fullName: true, email: true } },
        guest: { select: { id: true, fullName: true, email: true } },
      },
    });

    // Gửi thông báo cho SV/người tham gia khi sửa
    const modeText = updated.mode === AppointmentMode.ONLINE ? 'Trực tuyến' : 'Trực tiếp';
    const locText = updated.location ? ` tại phòng ${updated.location}` : '';
    const meetText = updated.meetingUrl ? ` (${updated.meetingUrl})` : '';

    await this.notifyParticipants(
      updated,
      userId,
      'Lịch hẹn đã được cập nhật',
      `Lịch hẹn "${updated.title}" đã được cập nhật. Thời gian mới: ${updated.startsAt.toLocaleString('vi-VN')} (${modeText}${locText}${meetText}).`,
      { appointmentId: id, status: updated.status },
    );

    return updated;
  }

  async cancel(userId: string, id: string) {
    const appointment = await this.findAndAuthorizeAppointment(userId, id);

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
      include: {
        group: {
          include: {
            members: {
              include: {
                student: { include: { user: true } },
              },
            },
          },
        },
        host: { select: { id: true, fullName: true, email: true } },
        guest: { select: { id: true, fullName: true, email: true } },
      },
    });

    // Gửi thông báo cho SV/người tham gia khi hủy
    await this.notifyParticipants(
      appointment,
      userId,
      'Lịch hẹn đã bị hủy',
      `Cuộc hẹn "${appointment.title}" dự kiến diễn ra lúc ${appointment.startsAt.toLocaleString('vi-VN')} đã bị hủy.`,
      { appointmentId: id, status: AppointmentStatus.CANCELLED },
    );

    return {
      success: true,
      message: 'Đã hủy lịch hẹn thành công',
      data: updated,
    };
  }

  async remind(userId: string, id: string) {
    const appointment = await this.findAndAuthorizeAppointment(userId, id);

    const modeText = appointment.mode === AppointmentMode.ONLINE ? 'Trực tuyến' : 'Trực tiếp';
    const locText = appointment.location ? ` tại phòng ${appointment.location}` : '';
    const meetText = appointment.meetingUrl ? ` (Link: ${appointment.meetingUrl})` : '';

    await this.notifyParticipants(
      appointment,
      userId,
      'Nhắc nhở: Lịch hẹn sắp diễn ra',
      `Nhắc nhở: Bạn có cuộc hẹn "${appointment.title}" vào lúc ${appointment.startsAt.toLocaleString('vi-VN')} (${modeText}${locText}${meetText}). Vui lòng tham gia đúng giờ.`,
      { appointmentId: id, isReminder: true },
    );

    return {
      success: true,
      message: 'Đã gửi nhắc nhở lịch hẹn thành công',
    };
  }

  async confirm(userId: string, id: string) {
    const appointment = await this.findAndAuthorizeAppointment(userId, id);

    let startsAt = appointment.startsAt;
    let endsAt = appointment.endsAt;

    if (appointment.proposedTime) {
      const duration = appointment.endsAt.getTime() - appointment.startsAt.getTime();
      startsAt = appointment.proposedTime;
      endsAt = new Date(startsAt.getTime() + duration);
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CONFIRMED,
        startsAt,
        endsAt,
      },
      include: {
        group: true,
        host: { select: { id: true, fullName: true } },
        guest: { select: { id: true, fullName: true } },
        proposedBy: { select: { id: true, fullName: true } },
      },
    });

    await this.notifyParticipants(
      appointment,
      userId,
      'Lịch hẹn đã được xác nhận',
      `Lịch hẹn "${appointment.title}" đã được xác nhận cho ngày ${startsAt.toLocaleString('vi-VN')}.`,
      { appointmentId: id, status: AppointmentStatus.CONFIRMED },
    );

    return updated;
  }

  async proposeTime(userId: string, id: string, dto: ProposeTimeDto) {
    const appointment = await this.findAndAuthorizeAppointment(userId, id);

    if (!appointment.allowProposeTime) {
      throw new BadRequestException('Giảng viên không cho phép đề xuất lại thời gian cho lịch hẹn này');
    }

    const proposed = new Date(dto.proposedTime);
    if (isNaN(proposed.getTime())) {
      throw new BadRequestException('Thời gian đề xuất không hợp lệ');
    }

    if (proposed.getTime() <= Date.now()) {
      throw new BadRequestException('Thời gian đề xuất phải trong tương lai');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.RESCHEDULED,
        proposedTime: proposed,
        proposeNote: dto.note,
        proposedById: userId,
      },
      include: {
        group: true,
        host: { select: { id: true, fullName: true } },
        guest: { select: { id: true, fullName: true } },
        proposedBy: { select: { id: true, fullName: true } },
      },
    });

    await this.notifyParticipants(
      appointment,
      userId,
      'Đề xuất thời gian lịch hẹn mới',
      `Đã có đề xuất thời gian mới cho lịch hẹn "${appointment.title}": ${proposed.toLocaleString('vi-VN')}${
        dto.note ? ` (Ghi chú: ${dto.note})` : ''
      }`,
      { appointmentId: id, proposedTime: dto.proposedTime, note: dto.note },
    );

    return updated;
  }

  async updateStatus(userId: string, id: string, status: AppointmentStatus) {
    const appointment = await this.findAndAuthorizeAppointment(userId, id);

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        group: true,
        host: { select: { id: true, fullName: true } },
        guest: { select: { id: true, fullName: true } },
      },
    });

    await this.notifyParticipants(
      appointment,
      userId,
      'Cập nhật lịch hẹn',
      `Lịch hẹn "${appointment.title}" đã chuyển sang trạng thái ${status}`,
      { appointmentId: id, status },
    );

    return updated;
  }

  private async findAndAuthorizeAppointment(userId: string, id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        group: {
          include: {
            members: {
              include: {
                student: true,
              },
            },
          },
        },
        host: true,
        guest: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Không tìm thấy lịch hẹn');
    }

    const isHost = appointment.hostId === userId;
    const isGuest = appointment.guestId === userId;
    const isMember = appointment.group.members.some((m) => m.student?.userId === userId);

    if (!isHost && !isGuest && !isMember) {
      throw new ForbiddenException('Bạn không thuộc lịch hẹn này');
    }

    return appointment;
  }

  private async notifyParticipants(
    appointment: any,
    senderUserId: string,
    title: string,
    message: string,
    data?: any,
  ) {
    const recipientIds = new Set<string>();

    if (appointment.hostId && appointment.hostId !== senderUserId) {
      recipientIds.add(appointment.hostId);
    }
    if (appointment.guestId && appointment.guestId !== senderUserId) {
      recipientIds.add(appointment.guestId);
    }
    if (appointment.group?.members) {
      for (const member of appointment.group.members) {
        if (member.student?.userId && member.student.userId !== senderUserId) {
          recipientIds.add(member.student.userId);
        }
      }
    }

    for (const recipientId of recipientIds) {
      await this.notifications.create(
        recipientId,
        title,
        message,
        NotificationType.APPOINTMENT,
        data,
        true,
      );
    }
  }
}
