import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssignReviewerDto } from './dto/assign-reviewer.dto';
import { AssignReviewersDto } from './dto/assign-reviewers.dto';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { CreateDefenseCommitteeDto } from './dto/create-defense-committee.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { ScheduleDefenseDto } from './dto/schedule-defense.dto';

@Injectable()
export class DefenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async schedules(semesterId?: string) {
    return this.prisma.defenseSchedule.findMany({
      where: semesterId ? { semesterId } : undefined,
      include: {
        group: {
          include: {
            topic: {
              include: {
                owner: { select: { id: true, fullName: true, email: true } },
              },
            },
            members: { include: { student: { include: { user: { select: { fullName: true } } } } } },
            reviewerAssignments: {
              include: {
                lecturer: { include: { user: { select: { id: true, fullName: true, email: true } } } },
              },
            },
          },
        },
        committee: {
          include: { members: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async assignments() {
    return this.prisma.reviewerAssignment.findMany({
      include: {
        group: { include: { topic: true } },
        lecturer: { include: { user: { select: { fullName: true } } } },
      },
    });
  }

  async committees(departmentId?: string) {
    return this.prisma.defenseCommittee.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: {
        members: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        schedules: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async assignReviewer(userId: string, dto: AssignReviewerDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      include: {
        topic: { select: { ownerId: true, title: true } },
        members: { include: { student: { include: { user: true } } } },
      },
    });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');

    const lecturer = await this.prisma.lecturerProfile.findUnique({
      where: { id: dto.lecturerId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!lecturer) throw new NotFoundException('Không tìm thấy giảng viên');

    if (group.topic?.ownerId === lecturer.userId) {
      throw new BadRequestException('Không thể phân công GVHD làm phản biện cho chính nhóm này');
    }

    if (group.midtermStatus !== 'CONTINUE') {
      throw new BadRequestException('Chỉ nhóm được xác nhận CHO_LAM_TIEP ở giữa kỳ mới được phân công phản biện');
    }

    const result = await this.prisma.reviewerAssignment.upsert({
      where: { groupId_lecturerId: { groupId: dto.groupId, lecturerId: dto.lecturerId } },
      update: { type: dto.type ?? 'PRIMARY', assignedBy: userId },
      create: {
        groupId: dto.groupId,
        lecturerId: dto.lecturerId,
        type: dto.type ?? 'PRIMARY',
        assignedBy: userId,
      },
    });

    const topicTitle = group.topic?.title || group.name;
    const reviewerRole = dto.type === AssignmentType.ADDITIONAL ? 'Phản biện phụ' : 'Phản biện chính';

    // 1. Gửi thông báo tới Giảng viên phản biện được phân công
    if (lecturer.userId) {
      await this.notifications.create({
        userId: lecturer.userId,
        title: 'Phân công phản biện Khóa luận tốt nghiệp',
        content: `Bạn đã được phân công làm Giảng viên phản biện (${reviewerRole}) cho đề tài "${topicTitle}".`,
        type: 'DEFENSE',
        data: { groupId: dto.groupId, reviewerId: dto.lecturerId, type: dto.type },
        sendEmail: true,
      });
    }

    // 2. Gửi thông báo tới sinh viên trong nhóm
    for (const member of group.members) {
      const studentUserId = member.student?.user?.id;
      if (studentUserId) {
        await this.notifications.create({
          userId: studentUserId,
          title: 'Phân công Giảng viên phản biện KLTN',
          content: `Đề tài "${topicTitle}" của nhóm đã được phân công Giảng viên phản biện: ${lecturer.user?.fullName || 'Thầy/Cô'} (${reviewerRole}).`,
          type: 'DEFENSE',
          data: {
            groupId: dto.groupId,
            reviewerId: dto.lecturerId,
            lecturerName: lecturer.user?.fullName,
          },
          sendEmail: true,
        });
      }
    }

    return result;
  }

  async assignTwoReviewers(userId: string, dto: AssignReviewersDto) {
    if (!dto.reviewerIds || dto.reviewerIds.length !== 2) {
      throw new BadRequestException('Phải phân công đúng 2 giảng viên phản biện');
    }

    const [id1, id2] = dto.reviewerIds;
    if (id1 === id2) {
      throw new BadRequestException('Hai giảng viên phản biện không được trùng nhau');
    }

    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      include: {
        topic: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                lecturerProfile: { select: { id: true } },
              },
            },
          },
        },
        members: { include: { student: { include: { user: true } } } },
      },
    });

    if (!group) throw new NotFoundException('Không tìm thấy nhóm KLTN');

    if (group.midtermStatus !== 'CONTINUE') {
      throw new BadRequestException('Chỉ nhóm được xác nhận CHO_LAM_TIEP ở giữa kỳ mới được phân công phản biện');
    }

    const findLecturer = async (id: string) => {
      return this.prisma.lecturerProfile.findFirst({
        where: {
          OR: [{ id }, { userId: id }],
        },
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
          quotas: { where: { semesterId: group.semesterId } },
        },
      });
    };

    const lecturer1 = await findLecturer(id1);
    const lecturer2 = await findLecturer(id2);

    if (!lecturer1 || !lecturer2) {
      throw new NotFoundException('Không tìm thấy một trong hai giảng viên phản biện được chọn');
    }

    if (lecturer1.id === lecturer2.id) {
      throw new BadRequestException('Hai giảng viên phản biện không được trùng nhau');
    }

    // Ngoại lệ: Trùng GVHD -> 400
    const advisorUserId = group.topic?.ownerId;
    const advisorLecturerId = group.topic?.owner?.lecturerProfile?.id;

    if (
      (advisorUserId && (lecturer1.userId === advisorUserId || lecturer2.userId === advisorUserId)) ||
      (advisorLecturerId && (lecturer1.id === advisorLecturerId || lecturer2.id === advisorLecturerId))
    ) {
      throw new BadRequestException('Không thể phân công GVHD làm phản biện cho chính nhóm này (Trùng GVHD)');
    }

    // Kiểm tra trạng thái hoạt động của giảng viên
    if (lecturer1.user?.status !== 'ACTIVE' || lecturer2.user?.status !== 'ACTIVE') {
      throw new BadRequestException('Giảng viên phản biện phải ở trạng thái ACTIVE');
    }

    // Kiểm tra định mức tải (Load check)
    const maxReviewConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'MAX_REVIEW_GROUPS', semesterId: group.semesterId },
    });
    const defaultMax = typeof maxReviewConfig?.value === 'number' ? maxReviewConfig.value : 5;

    for (const lec of [lecturer1, lecturer2]) {
      const currentLoad = await this.prisma.reviewerAssignment.count({
        where: {
          lecturerId: lec.id,
          groupId: { not: group.id },
          group: {
            semesterId: group.semesterId,
            status: { not: 'CANCELLED' },
          },
        },
      });
      const maxGroups = lec.quotas[0]?.maxGroups ?? defaultMax;
      if (currentLoad >= maxGroups) {
        throw new BadRequestException(
          `Giảng viên ${lec.user?.fullName} đã đạt định mức phản biện tối đa (${currentLoad}/${maxGroups} nhóm). Không thể nhận thêm.`,
        );
      }
    }

    // Thực hiện phân công trong Transaction
    const assignments = await this.prisma.$transaction(async (tx) => {
      await tx.reviewerAssignment.deleteMany({
        where: { groupId: dto.groupId },
      });

      const a1 = await tx.reviewerAssignment.create({
        data: {
          groupId: dto.groupId,
          lecturerId: lecturer1.id,
          type: AssignmentType.PRIMARY,
          assignedBy: userId,
        },
        include: {
          lecturer: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        },
      });

      const a2 = await tx.reviewerAssignment.create({
        data: {
          groupId: dto.groupId,
          lecturerId: lecturer2.id,
          type: AssignmentType.ADDITIONAL,
          assignedBy: userId,
        },
        include: {
          lecturer: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        },
      });

      return [a1, a2];
    });

    const topicTitle = group.topic?.title || group.name;

    // Gửi thông báo đến 2 GVPB
    if (lecturer1.userId) {
      await this.notifications.create({
        userId: lecturer1.userId,
        title: 'Phân công phản biện KLTN (GVPB 1 - Phản biện chính)',
        content: `Bạn đã được phân công làm Giảng viên phản biện chính (GVPB 1) cho đề tài "${topicTitle}". Đồng phản biện: ${lecturer2.user?.fullName}.`,
        type: 'DEFENSE',
        data: { groupId: dto.groupId, reviewerId: lecturer1.id, type: AssignmentType.PRIMARY },
        sendEmail: true,
      });
    }

    if (lecturer2.userId) {
      await this.notifications.create({
        userId: lecturer2.userId,
        title: 'Phân công phản biện KLTN (GVPB 2 - Phản biện phụ)',
        content: `Bạn đã được phân công làm Giảng viên phản biện (GVPB 2) cho đề tài "${topicTitle}". Đồng phản biện: ${lecturer1.user?.fullName}.`,
        type: 'DEFENSE',
        data: { groupId: dto.groupId, reviewerId: lecturer2.id, type: AssignmentType.ADDITIONAL },
        sendEmail: true,
      });
    }

    // Gửi thông báo đến sinh viên trong nhóm
    for (const member of group.members) {
      const studentUserId = member.student?.user?.id;
      if (studentUserId) {
        await this.notifications.create({
          userId: studentUserId,
          title: 'Phân công 2 Giảng viên phản biện KLTN',
          content: `Đề tài "${topicTitle}" của nhóm đã được phân công 2 Giảng viên phản biện: GVPB 1: ${lecturer1.user?.fullName || 'Thầy/Cô'} và GVPB 2: ${lecturer2.user?.fullName || 'Thầy/Cô'}.`,
          type: 'DEFENSE',
          data: {
            groupId: dto.groupId,
            reviewer1: { id: lecturer1.id, name: lecturer1.user?.fullName },
            reviewer2: { id: lecturer2.id, name: lecturer2.user?.fullName },
          },
          sendEmail: true,
        });
      }
    }

    return {
      message: 'Phân công 2 Giảng viên phản biện thành công',
      groupId: group.id,
      groupCode: group.code,
      topicTitle,
      assignments: assignments.map((a) => ({
        id: a.id,
        lecturerId: a.lecturerId,
        lecturerName: a.lecturer.user?.fullName,
        type: a.type,
        assignedAt: a.assignedAt,
      })),
    };
  }

  async createCommittee(dto: CreateCommitteeDto) {
    return this.prisma.defenseCommittee.create({
      data: {
        name: dto.name,
        departmentId: dto.departmentId,
        members: {
          create: dto.memberIds.map((userId, index) => ({
            userId,
            role: index === 0 ? 'Chủ tịch' : 'Thành viên',
          })),
        },
      },
      include: {
        members: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });
  }

  async createDefenseCommittee(userId: string, dto: CreateDefenseCommitteeDto) {
    const semester = await this.prisma.semester.findUnique({
      where: { id: dto.semesterId },
      include: { department: true },
    });
    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    // 1. Kiểm tra số lượng thành viên tối thiểu
    const minConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'MIN_COMMITTEE_MEMBERS', semesterId: dto.semesterId },
    });
    const minMembers = typeof minConfig?.value === 'number' ? minConfig.value : 3;
    if (!dto.memberIds || dto.memberIds.length < minMembers) {
      throw new BadRequestException(
        `Hội đồng bảo vệ phải có tối thiểu ${minMembers} thành viên (Chủ tịch, Thư ký, Ủy viên)`,
      );
    }

    // Kiểm tra trùng lặp ID thành viên
    const uniqueMemberIds = new Set(dto.memberIds);
    if (uniqueMemberIds.size !== dto.memberIds.length) {
      throw new BadRequestException('Danh sách thành viên hội đồng không được chứa người trùng nhau');
    }

    // Resolve thông tin tất cả các thành viên (hỗ trợ cả userId hoặc lecturerProfileId)
    const resolvedMembers = await Promise.all(
      dto.memberIds.map(async (mId) => {
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [{ id: mId }, { lecturerProfile: { id: mId } }],
          },
          include: { lecturerProfile: true },
        });
        if (!user) {
          throw new NotFoundException(`Không tìm thấy thành viên có ID: ${mId}`);
        }
        if (user.status !== 'ACTIVE') {
          throw new BadRequestException(`Thành viên ${user.fullName} đang không ở trạng thái ACTIVE`);
        }
        return user;
      }),
    );
    const memberUserIds = resolvedMembers.map((u) => u.id);
    const memberUserIdSet = new Set(memberUserIds);

    // 2. Kiểm tra danh sách nhóm và xung đột vai trò (Anti-conflict check)
    let groups: any[] = [];
    if (dto.groupIds && dto.groupIds.length > 0) {
      const uniqueGroupIds = Array.from(new Set(dto.groupIds));
      groups = await this.prisma.group.findMany({
        where: { id: { in: uniqueGroupIds } },
        include: {
          topic: {
            include: {
              owner: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      });

      if (groups.length !== uniqueGroupIds.length) {
        throw new NotFoundException('Một số nhóm KLTN không tồn tại trong hệ thống');
      }

      for (const group of groups) {
        if (group.semesterId !== dto.semesterId) {
          throw new BadRequestException(`Nhóm ${group.code} (${group.name}) không thuộc học kỳ này`);
        }

        if (group.midtermStatus !== 'CONTINUE') {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") chưa được xác nhận CHO_LAM_TIEP ở giữa kỳ`,
          );
        }

        // Kiểm tra không chấm nhóm mình hướng dẫn (Conflict check)
        const advisorUserId = group.topic?.ownerId;
        const advisorName = group.topic?.owner?.fullName || 'Giảng viên hướng dẫn';
        if (advisorUserId && memberUserIdSet.has(advisorUserId)) {
          const conflictingMember = resolvedMembers.find((m) => m.id === advisorUserId);
          throw new BadRequestException(
            `Xung đột vai trò: Giảng viên ${conflictingMember?.fullName || advisorName} là Giảng viên hướng dẫn của nhóm ${group.code} ("${group.topic?.title || group.name}"), không thể tham gia hội đồng chấm nhóm này!`,
          );
        }
      }
    }

    // 3. Tự động sinh tên hội đồng nếu để trống
    let committeeName = (dto.tenHoiDong || dto.name || '').trim();
    if (!committeeName) {
      const count = await this.prisma.defenseCommittee.count({
        where: { departmentId: semester.departmentId },
      });
      committeeName = `Hội đồng bảo vệ KLTN số ${count + 1} - ${semester.code}`;
    }

    // 4. Lưu hội đồng và liên kết các nhóm vào hội đồng trong Transaction
    const committee = await this.prisma.$transaction(async (tx) => {
      const newCommittee = await tx.defenseCommittee.create({
        data: {
          name: committeeName,
          departmentId: semester.departmentId,
          members: {
            create: memberUserIds.map((userId, index) => ({
              userId,
              role:
                index === 0
                  ? 'Chủ tịch'
                  : index === 1
                  ? 'Thư ký'
                  : index === 2
                  ? 'Ủy viên phản biện'
                  : 'Ủy viên',
            })),
          },
        },
        include: {
          members: {
            include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
          },
        },
      });

      // Liên kết các nhóm với Hội đồng qua DefenseSchedule
      if (groups.length > 0) {
        for (const group of groups) {
          const existingSchedule = await tx.defenseSchedule.findFirst({
            where: { groupId: group.id, semesterId: dto.semesterId },
          });

          if (existingSchedule) {
            await tx.defenseSchedule.update({
              where: { id: existingSchedule.id },
              data: { committeeId: newCommittee.id },
            });
          } else {
            const startsAt = semester.defenseFrom ?? new Date();
            const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
            await tx.defenseSchedule.create({
              data: {
                groupId: group.id,
                semesterId: dto.semesterId,
                committeeId: newCommittee.id,
                status: 'DRAFT',
                startsAt,
                endsAt,
              },
            });
          }
        }
      }

      return newCommittee;
    });

    // 5. Gửi thông báo đến thành viên hội đồng
    for (const m of committee.members) {
      await this.notifications.create({
        userId: m.userId,
        title: 'Quyết định thành lập Hội đồng bảo vệ KLTN',
        content: `Bạn được phân công tham gia "${committee.name}" với vai trò ${m.role}. Hội đồng phụ trách chấm ${groups.length} nhóm đề tài KLTN.`,
        type: 'DEFENSE',
        data: { committeeId: committee.id, role: m.role, groupCount: groups.length },
        sendEmail: true,
      });
    }

    // 6. Gửi thông báo đến sinh viên trong các nhóm được chấm
    for (const group of groups) {
      const groupMembers = await this.prisma.groupMember.findMany({
        where: { groupId: group.id },
        include: { student: { include: { user: true } } },
      });
      for (const gm of groupMembers) {
        const studentUserId = gm.student?.user?.id;
        if (studentUserId) {
          await this.notifications.create({
            userId: studentUserId,
            title: 'Phân công Hội đồng bảo vệ Khóa luận tốt nghiệp',
            content: `Nhóm đề tài "${group.topic?.title || group.name}" của bạn đã được phân công vào "${committee.name}".`,
            type: 'DEFENSE',
            data: { committeeId: committee.id, groupId: group.id },
            sendEmail: true,
          });
        }
      }
    }

    return {
      message: 'Thành lập Hội đồng bảo vệ KLTN thành công',
      id: committee.id,
      name: committee.name,
      departmentId: committee.departmentId,
      semesterId: dto.semesterId,
      members: committee.members.map((m) => ({
        userId: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        role: m.role,
      })),
      assignedGroups: groups.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        topicTitle: g.topic?.title,
        advisorName: g.topic?.owner?.fullName,
      })),
      groupCount: groups.length,
    };
  }

  async getAvailableCommitteeMembers(semesterId: string, groupIds?: string[]) {
    const semester = await this.prisma.semester.findUnique({
      where: { id: semesterId },
      include: { department: true },
    });
    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    const advisorUserIds = new Set<string>();
    const advisorMap = new Map<string, string>();

    if (groupIds && groupIds.length > 0) {
      const groups = await this.prisma.group.findMany({
        where: { id: { in: groupIds } },
        include: { topic: { include: { owner: true } } },
      });
      for (const g of groups) {
        if (g.topic?.ownerId) {
          advisorUserIds.add(g.topic.ownerId);
          advisorMap.set(g.topic.ownerId, g.code);
        }
      }
    }

    const lecturers = await this.prisma.lecturerProfile.findMany({
      where: {
        departmentId: semester.departmentId,
        user: { status: 'ACTIVE' },
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ user: { fullName: 'asc' } }],
    });

    return lecturers.map((lec) => {
      const isAdvisorOfSelectedGroup = advisorUserIds.has(lec.userId);
      const groupCode = isAdvisorOfSelectedGroup ? advisorMap.get(lec.userId) : null;
      const isEligible = !isAdvisorOfSelectedGroup;
      const reason = isAdvisorOfSelectedGroup
        ? `Là GVHD của nhóm ${groupCode} (xung đột vai trò - không được chấm nhóm mình hướng dẫn)`
        : null;

      return {
        id: lec.id,
        userId: lec.userId,
        lecturerCode: lec.lecturerCode,
        fullName: lec.user?.fullName || '',
        email: lec.user?.email || '',
        title: lec.title || 'Giảng viên',
        department: lec.department,
        isEligible,
        isAdvisorOfSelectedGroup,
        reason,
      };
    });
  }

  async listDefenseCommittees(semesterId?: string) {
    const where: any = {};
    if (semesterId) {
      where.schedules = { some: { semesterId } };
    }

    const committees = await this.prisma.defenseCommittee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
          },
          orderBy: { role: 'asc' },
        },
        schedules: {
          include: {
            group: {
              include: {
                topic: {
                  include: {
                    owner: { select: { id: true, fullName: true, email: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return committees.map((c) => ({
      id: c.id,
      name: c.name,
      departmentId: c.departmentId,
      department: c.department,
      members: c.members.map((m) => ({
        userId: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        phone: m.user.phone,
        role: m.role,
      })),
      assignedGroups: c.schedules
        .filter((s) => s.group)
        .map((s) => ({
          id: s.group.id,
          code: s.group.code,
          name: s.group.name,
          topicTitle: s.group.topic?.title,
          advisorName: s.group.topic?.owner?.fullName,
          room: s.room,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          status: s.status,
        })),
      groupCount: c.schedules.filter((s) => s.group).length,
    }));
  }

  async createSchedule(dto: CreateScheduleDto) {
    return this.scheduleDefense('system', dto);
  }

  async scheduleDefense(userId: string, dto: ScheduleDefenseDto) {
    const rawStartsAt = dto.startsAt || dto.ngayGio;
    if (!rawStartsAt) {
      throw new BadRequestException('Vui lòng cung cấp thời gian bảo vệ (ngayGio hoặc startsAt)');
    }

    const startDateTime = new Date(rawStartsAt);
    if (isNaN(startDateTime.getTime())) {
      throw new BadRequestException('Thời gian bắt đầu không hợp lệ');
    }

    let endDateTime: Date;
    if (dto.endsAt) {
      endDateTime = new Date(dto.endsAt);
      if (isNaN(endDateTime.getTime())) {
        throw new BadRequestException('Thời gian kết thúc không hợp lệ');
      }
    } else {
      const duration = dto.durationMinutes && dto.durationMinutes > 0 ? dto.durationMinutes : 60;
      endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
    }

    if (endDateTime <= startDateTime) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }

    const room = (dto.room || dto.phongId || '').trim();
    if (!room) {
      throw new BadRequestException('Vui lòng cung cấp thông tin phòng bảo vệ (room hoặc phongId)');
    }

    if (!dto.committeeId && !dto.groupId && (!dto.groupIds || dto.groupIds.length === 0)) {
      throw new BadRequestException('Vui lòng cung cấp committeeId hoặc groupId để xếp lịch bảo vệ');
    }

    let committee: any = null;
    let committeeId = dto.committeeId;

    let targetGroupIds: string[] = [];
    if (dto.groupId) {
      targetGroupIds = [dto.groupId];
    } else if (dto.groupIds && dto.groupIds.length > 0) {
      targetGroupIds = Array.from(new Set(dto.groupIds));
    }

    if (committeeId) {
      committee = await this.prisma.defenseCommittee.findUnique({
        where: { id: committeeId },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
          department: true,
          schedules: {
            where: { status: { not: 'CANCELLED' } },
            include: { group: true },
          },
        },
      });
      if (!committee) {
        throw new NotFoundException(`Không tìm thấy Hội đồng bảo vệ có ID: ${committeeId}`);
      }

      if (targetGroupIds.length === 0) {
        const assignedGroupIds = committee.schedules
          .map((s: any) => s.groupId)
          .filter(Boolean);
        targetGroupIds = Array.from(new Set(assignedGroupIds));
        if (targetGroupIds.length === 0) {
          throw new BadRequestException(
            `Hội đồng "${committee.name}" hiện chưa được phân công nhóm nào. Vui lòng chọn nhóm bảo vệ.`,
          );
        }
      }
    }

    const groups = await this.prisma.group.findMany({
      where: { id: { in: targetGroupIds } },
      include: {
        topic: {
          include: {
            owner: { select: { id: true, fullName: true, email: true } },
          },
        },
        members: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
        reviewerAssignments: {
          include: {
            lecturer: {
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
        defenses: {
          where: { status: { not: 'CANCELLED' } },
          include: { committee: { include: { members: { include: { user: true } } } } },
        },
      },
    });

    if (groups.length !== targetGroupIds.length) {
      throw new NotFoundException('Một hoặc nhiều nhóm KLTN không tồn tại');
    }

    for (const g of groups) {
      if (g.midtermStatus !== 'CONTINUE') {
        throw new BadRequestException(
          `Nhóm ${g.code} chưa được xác nhận CHO_LAM_TIEP ở giữa kỳ, không đủ điều kiện xếp lịch bảo vệ`,
        );
      }
    }

    if (!committee) {
      for (const g of groups) {
        const existingCommitteeId = g.defenses.find((s: any) => s.committeeId)?.committeeId;
        if (existingCommitteeId) {
          committeeId = existingCommitteeId;
          committee = await this.prisma.defenseCommittee.findUnique({
            where: { id: committeeId },
            include: {
              members: {
                include: {
                  user: { select: { id: true, fullName: true, email: true } },
                },
              },
            },
          });
          break;
        }
      }
    }

    // Identify target schedule IDs to exclude from conflict checking (so rescheduling won't conflict with itself)
    const targetScheduleIds = groups.flatMap((g) => g.defenses.map((s) => s.id));

    // 1. Check Room Clash (Trùng phòng)
    const conflictingRoomSchedules = await this.prisma.defenseSchedule.findMany({
      where: {
        room: { equals: room, mode: 'insensitive' },
        status: { not: 'CANCELLED' },
        id: { notIn: targetScheduleIds },
        startsAt: { lt: endDateTime },
        endsAt: { gt: startDateTime },
      },
      include: {
        group: { select: { id: true, code: true, name: true } },
        committee: { select: { id: true, name: true } },
      },
    });

    if (conflictingRoomSchedules.length > 0) {
      const clash = conflictingRoomSchedules[0];
      const startStr = clash.startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + clash.startsAt.toLocaleDateString('vi-VN');
      const endStr = clash.endsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + clash.endsAt.toLocaleDateString('vi-VN');
      const comStr = clash.committee?.name ? ` (${clash.committee.name})` : '';
      throw new BadRequestException(
        `Xung đột phòng: Phòng "${room}" đã có lịch bảo vệ của nhóm ${clash.group?.code || clash.group?.name}${comStr} từ ${startStr} đến ${endStr}. Vui lòng chọn phòng hoặc khung giờ khác.`,
      );
    }

    // 2. Check Committee Member Clash (Trùng thành viên hội đồng)
    if (committee && committee.members && committee.members.length > 0) {
      const committeeMemberUserIds = committee.members.map((m: any) => m.userId);

      const overlappingSchedules = await this.prisma.defenseSchedule.findMany({
        where: {
          committeeId: { not: committee.id },
          status: { not: 'CANCELLED' },
          startsAt: { lt: endDateTime },
          endsAt: { gt: startDateTime },
        },
        include: {
          committee: {
            include: {
              members: {
                where: { userId: { in: committeeMemberUserIds } },
                include: { user: { select: { id: true, fullName: true } } },
              },
            },
          },
          group: { select: { id: true, code: true, name: true } },
        },
      });

      for (const ov of overlappingSchedules) {
        if (ov.committee?.members && ov.committee.members.length > 0) {
          const clashMember = ov.committee.members[0];
          const startStr = ov.startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + ov.startsAt.toLocaleDateString('vi-VN');
          const endStr = ov.endsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + ov.endsAt.toLocaleDateString('vi-VN');
          throw new BadRequestException(
            `Xung đột lịch thành viên hội đồng: Giảng viên ${clashMember.user.fullName} đã có lịch tham gia "${ov.committee.name}" (Nhóm ${ov.group?.code}) tại phòng ${ov.room || 'chưa xếp'} từ ${startStr} đến ${endStr}. Không thể tham gia 2 hội đồng cùng thời điểm!`,
          );
        }
      }
    }

    // 3. Check Group Clash (if group scheduled in another overlapping time)
    for (const g of groups) {
      const otherGroupSchedule = await this.prisma.defenseSchedule.findFirst({
        where: {
          groupId: g.id,
          id: { notIn: targetScheduleIds },
          status: { not: 'CANCELLED' },
          startsAt: { lt: endDateTime },
          endsAt: { gt: startDateTime },
        },
      });
      if (otherGroupSchedule) {
        throw new BadRequestException(
          `Nhóm ${g.code} đã có lịch bảo vệ khác trong khoảng thời gian này`,
        );
      }
    }

    // 4. Update or Create DefenseSchedules in DB
    const totalDurationMs = endDateTime.getTime() - startDateTime.getTime();
    const slotDurationMs = groups.length > 1 ? totalDurationMs / groups.length : totalDurationMs;

    const savedSchedules = await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (let i = 0; i < groups.length; i++) {
        const grp = groups[i];
        const slotStart = groups.length > 1 ? new Date(startDateTime.getTime() + i * slotDurationMs) : startDateTime;
        const slotEnd = groups.length > 1 ? new Date(startDateTime.getTime() + (i + 1) * slotDurationMs) : endDateTime;

        // Check if existing draft schedule for this group exists
        const existingSchedule = grp.defenses.find((s: any) => s.groupId === grp.id);

        let sRecord;
        if (existingSchedule) {
          sRecord = await tx.defenseSchedule.update({
            where: { id: existingSchedule.id },
            data: {
              room,
              startsAt: slotStart,
              endsAt: slotEnd,
              status: 'SCHEDULED',
              committeeId: committeeId || existingSchedule.committeeId,
            },
            include: {
              group: {
                include: {
                  topic: { include: { owner: true } },
                  members: { include: { student: { include: { user: true } } } },
                },
              },
              committee: true,
            },
          });
        } else {
          sRecord = await tx.defenseSchedule.create({
            data: {
              groupId: grp.id,
              semesterId: dto.semesterId || grp.semesterId,
              committeeId: committeeId || undefined,
              room,
              startsAt: slotStart,
              endsAt: slotEnd,
              status: 'SCHEDULED',
            },
            include: {
              group: {
                include: {
                  topic: { include: { owner: true } },
                  members: { include: { student: { include: { user: true } } } },
                },
              },
              committee: true,
            },
          });
        }
        results.push(sRecord);
      }
      return results;
    });

    // 5. Send notifications to all stakeholders
    const shouldNotify = dto.notify !== false;
    if (shouldNotify) {
      for (let i = 0; i < groups.length; i++) {
        const grp = groups[i];
        const saved = savedSchedules[i];
        const topicTitle = grp.topic?.title || grp.name;
        const committeeName = committee?.name || saved.committee?.name;
        const startStr = saved.startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + saved.startsAt.toLocaleDateString('vi-VN');
        const endStr = saved.endsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + saved.endsAt.toLocaleDateString('vi-VN');

        // 5a. Students in group
        for (const m of grp.members) {
          const studentUserId = m.student?.user?.id;
          if (studentUserId) {
            await this.notifications.create({
              userId: studentUserId,
              title: 'Đã có lịch bảo vệ Khóa luận tốt nghiệp chính thức',
              content: `Nhóm "${grp.code}" (Đề tài: ${topicTitle}) đã có lịch bảo vệ chính thức từ ${startStr} đến ${endStr} tại phòng ${room}${committeeName ? ` trước Hội đồng "${committeeName}"` : ''}.`,
              type: 'DEFENSE',
              data: {
                scheduleId: saved.id,
                groupId: grp.id,
                startsAt: saved.startsAt,
                endsAt: saved.endsAt,
                room,
                committeeId: committee?.id,
              },
              sendEmail: true,
            });
          }
        }

        // 5b. Supervisor (GVHD)
        const advisorUserId = grp.topic?.ownerId || grp.topic?.owner?.id;
        if (advisorUserId) {
          await this.notifications.create({
            userId: advisorUserId,
            title: 'Lịch bảo vệ KLTN cho nhóm sinh viên bạn hướng dẫn',
            content: `Nhóm sinh viên bạn hướng dẫn (${grp.code} - ${topicTitle}) đã được xếp lịch bảo vệ từ ${startStr} đến ${endStr} tại phòng ${room}${committeeName ? ` trước Hội đồng "${committeeName}"` : ''}.`,
            type: 'DEFENSE',
            data: {
              scheduleId: saved.id,
              groupId: grp.id,
              startsAt: saved.startsAt,
              endsAt: saved.endsAt,
              room,
            },
            sendEmail: true,
          });
        }

        // 5c. Reviewers (GVPB)
        for (const r of grp.reviewerAssignments || []) {
          const reviewerUserId = r.lecturer?.user?.id;
          if (reviewerUserId) {
            await this.notifications.create({
              userId: reviewerUserId,
              title: 'Lịch bảo vệ KLTN của nhóm bạn phản biện',
              content: `Nhóm sinh viên bạn phản biện (${grp.code} - ${topicTitle}) đã được xếp lịch bảo vệ từ ${startStr} đến ${endStr} tại phòng ${room}.`,
              type: 'DEFENSE',
              data: {
                scheduleId: saved.id,
                groupId: grp.id,
                startsAt: saved.startsAt,
                endsAt: saved.endsAt,
                room,
              },
              sendEmail: true,
            });
          }
        }
      }

      // 5d. Committee members
      if (committee?.members && committee.members.length > 0) {
        const startStr = startDateTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + startDateTime.toLocaleDateString('vi-VN');
        const endStr = endDateTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + endDateTime.toLocaleDateString('vi-VN');
        const groupCodesStr = groups.map((g) => g.code).join(', ');

        for (const m of committee.members) {
          await this.notifications.create({
            userId: m.userId,
            title: 'Lịch chấm Hội đồng bảo vệ Khóa luận tốt nghiệp',
            content: `Bạn có lịch chấm Hội đồng "${committee.name}" (Vai trò: ${m.role}) tại phòng ${room} từ ${startStr} đến ${endStr} cho các nhóm: ${groupCodesStr}.`,
            type: 'DEFENSE',
            data: {
              committeeId: committee.id,
              startsAt: startDateTime,
              endsAt: endDateTime,
              room,
              groupCount: groups.length,
            },
            sendEmail: true,
          });
        }
      }
    }

    return {
      message: 'Xếp lịch và phòng bảo vệ thành công',
      room,
      startsAt: startDateTime,
      endsAt: endDateTime,
      committee: committee
        ? {
            id: committee.id,
            name: committee.name,
            members: committee.members?.map((m: any) => ({
              userId: m.userId,
              fullName: m.user?.fullName,
              role: m.role,
            })),
          }
        : null,
      schedules: savedSchedules.map((s) => ({
        id: s.id,
        groupId: s.groupId,
        groupCode: s.group?.code,
        groupName: s.group?.name,
        topicTitle: s.group?.topic?.title,
        room: s.room,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
      })),
      groupCount: savedSchedules.length,
    };
  }
}
