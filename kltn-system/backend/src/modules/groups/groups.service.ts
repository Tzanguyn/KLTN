import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { MidtermDto } from './dto/midterm.dto';
import { QueryGroupsDto } from './dto/query-groups.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findGroups(query: QueryGroupsDto, userId?: string) {
    const where: any = {};

    if (query.readyForReview === 'true') {
      where.midtermStatus = 'CONTINUE';
      where.status = { not: 'CANCELLED' };
    }

    if (query.readyForDefense === 'true') {
      where.midtermStatus = 'CONTINUE';
      where.status = { not: 'CANCELLED' };
    } else if (query.readyForDefense === 'false') {
      where.OR = [
        { midtermStatus: { not: 'CONTINUE' } },
        { status: 'CANCELLED' },
      ];
    }

    if (query.semesterId) {
      where.semesterId = query.semesterId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.topicId) {
      where.topicId = query.topicId;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { topic: { title: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const groups = await this.prisma.group.findMany({
      where,
      include: {
        topic: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                lecturerProfile: { select: { id: true, lecturerCode: true, title: true } },
              },
            },
          },
        },
        semester: {
          select: { id: true, code: true, name: true, status: true },
        },
        members: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
                department: { select: { id: true, code: true, name: true } },
              },
            },
          },
          orderBy: { isLeader: 'desc' },
        },
        reviewerAssignments: {
          include: {
            lecturer: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
              },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
        defenses: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            committee: {
              include: {
                members: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true } },
                  },
                },
              },
            },
          },
          orderBy: { startsAt: 'asc' },
        },
      },
      orderBy: [{ code: 'asc' }],
    });

    return groups.map((g) => {
      const primaryReviewer =
        g.reviewerAssignments.find((r) => r.type === 'PRIMARY') || g.reviewerAssignments[0];
      const additionalReviewer =
        g.reviewerAssignments.find((r) => r.type === 'ADDITIONAL') ||
        (g.reviewerAssignments.length > 1 ? g.reviewerAssignments[1] : null);
      const isReadyForReview = g.midtermStatus === 'CONTINUE';
      const hasTwoReviewers = g.reviewerAssignments.length >= 2;
      const isReadyForDefense = g.midtermStatus === 'CONTINUE' && g.status !== 'CANCELLED';
      const defenseSchedule = g.defenses?.[0] || null;
      const hasDefenseSchedule = (g.defenses?.length ?? 0) > 0;
      const defenseEligibility = {
        eligible: isReadyForDefense,
        reason: isReadyForDefense
          ? 'Đủ điều kiện bảo vệ (Đạt đánh giá giữa kỳ: CHO LÀM TIẾP)'
          : g.status === 'CANCELLED'
          ? 'Nhóm đã bị hủy'
          : g.midtermStatus === 'STOPPED'
          ? 'Không đủ điều kiện bảo vệ (Đã bị dừng đề tài ở giữa kỳ)'
          : 'Chưa đủ điều kiện bảo vệ (Chưa có kết quả đánh giá giữa kỳ đạt yêu cầu)',
      };

      return {
        ...g,
        memberCount: g.members.length,
        isReadyForReview,
        isReadyForDefense,
        defenseEligibility,
        defenseSchedule,
        hasDefenseSchedule,
        hasTwoReviewers,
        reviewerCount: g.reviewerAssignments.length,
        primaryReviewer: primaryReviewer
          ? {
              id: primaryReviewer.id,
              lecturerId: primaryReviewer.lecturerId,
              fullName: primaryReviewer.lecturer?.user?.fullName,
              email: primaryReviewer.lecturer?.user?.email,
              type: primaryReviewer.type,
            }
          : null,
        additionalReviewer: additionalReviewer
          ? {
              id: additionalReviewer.id,
              lecturerId: additionalReviewer.lecturerId,
              fullName: additionalReviewer.lecturer?.user?.fullName,
              email: additionalReviewer.lecturer?.user?.email,
              type: additionalReviewer.type,
            }
          : null,
        gvhd: g.topic?.owner
          ? {
              id: g.topic.owner.id,
              fullName: g.topic.owner.fullName,
              email: g.topic.owner.email,
              phone: g.topic.owner.phone,
              lecturerProfileId: g.topic.owner.lecturerProfile?.id,
            }
          : null,
      };
    });
  }

  async findById(groupId: string, userId?: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        topic: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                lecturerProfile: { select: { id: true, lecturerCode: true, title: true } },
              },
            },
          },
        },
        semester: true,
        members: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
                department: { select: { id: true, code: true, name: true } },
              },
            },
          },
          orderBy: { isLeader: 'desc' },
        },
        reviewerAssignments: {
          include: {
            lecturer: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
              },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
        defenses: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            committee: {
              include: {
                members: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true } },
                  },
                },
              },
            },
          },
          orderBy: { startsAt: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    const primaryReviewer =
      group.reviewerAssignments.find((r) => r.type === 'PRIMARY') || group.reviewerAssignments[0];
    const additionalReviewer =
      group.reviewerAssignments.find((r) => r.type === 'ADDITIONAL') ||
      (group.reviewerAssignments.length > 1 ? group.reviewerAssignments[1] : null);
    const isReadyForDefense = group.midtermStatus === 'CONTINUE' && group.status !== 'CANCELLED';
    const defenseSchedule = group.defenses?.[0] || null;
    const hasDefenseSchedule = (group.defenses?.length ?? 0) > 0;
    const defenseEligibility = {
      eligible: isReadyForDefense,
      reason: isReadyForDefense
        ? 'Đủ điều kiện bảo vệ (Đạt đánh giá giữa kỳ: CHO LÀM TIẾP)'
        : group.status === 'CANCELLED'
        ? 'Nhóm đã bị hủy'
        : group.midtermStatus === 'STOPPED'
        ? 'Không đủ điều kiện bảo vệ (Đã bị dừng đề tài ở giữa kỳ)'
        : 'Chưa đủ điều kiện bảo vệ (Chưa có kết quả đánh giá giữa kỳ đạt yêu cầu)',
    };

    return {
      ...group,
      memberCount: group.members.length,
      isReadyForReview: group.midtermStatus === 'CONTINUE',
      isReadyForDefense,
      defenseEligibility,
      defenseSchedule,
      hasDefenseSchedule,
      hasTwoReviewers: group.reviewerAssignments.length >= 2,
      reviewerCount: group.reviewerAssignments.length,
      primaryReviewer: primaryReviewer
        ? {
            id: primaryReviewer.id,
            lecturerId: primaryReviewer.lecturerId,
            fullName: primaryReviewer.lecturer?.user?.fullName,
            email: primaryReviewer.lecturer?.user?.email,
            type: primaryReviewer.type,
          }
        : null,
      additionalReviewer: additionalReviewer
        ? {
            id: additionalReviewer.id,
            lecturerId: additionalReviewer.lecturerId,
            fullName: additionalReviewer.lecturer?.user?.fullName,
            email: additionalReviewer.lecturer?.user?.email,
            type: additionalReviewer.type,
          }
        : null,
      gvhd: group.topic?.owner
        ? {
            id: group.topic.owner.id,
            fullName: group.topic.owner.fullName,
            email: group.topic.owner.email,
            phone: group.topic.owner.phone,
            lecturerProfileId: group.topic.owner.lecturerProfile?.id,
          }
        : null,
    };
  }

  async list(userId: string) {
    return this.prisma.group.findMany({
      where: {
        OR: [{ topic: { ownerId: userId } }, { members: { some: { student: { userId } } } }],
      },
      include: {
        topic: {
          include: {
            owner: { select: { id: true, fullName: true, email: true, phone: true } },
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
      },
      orderBy: { code: 'asc' },
    });
  }

  async addMember(userId: string, groupId: string, dto: AddMemberDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        topic: { select: { id: true, ownerId: true, capacity: true } },
        members: {
          include: {
            student: { select: { id: true, userId: true } },
          },
        },
        semester: true,
      },
    });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');

    // Phân quyền: Chỉ GVHD của nhóm, Quản lý bộ môn, hoặc Trưởng nhóm SV (khi nhóm đang lập FORMING) mới được thao tác
    const isManager = await this.isManager(userId);
    const isAdvisor = group.topic?.ownerId === userId;
    const isLeader = group.members.some((m) => m.student.userId === userId && m.isLeader);

    if (!isManager && !isAdvisor && !(isLeader && group.status === 'FORMING')) {
      throw new ForbiddenException('Chỉ Giảng viên hướng dẫn của nhóm hoặc Quản lý bộ môn mới có quyền thêm thành viên vào nhóm này');
    }

    if (group.status === 'CANCELLED' || group.status === 'COMPLETED') {
      throw new BadRequestException('Không thể thêm thành viên vào nhóm đã hủy hoặc đã hoàn thành');
    }

    const student = await this.prisma.studentProfile.findUnique({
      where: { id: dto.studentId },
      include: { user: { select: { fullName: true } } },
    });
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên');

    if (group.members.some((member) => member.studentId === dto.studentId)) {
      throw new BadRequestException('Sinh viên đã thuộc nhóm');
    }

    // 1. Check số lượng thành viên không vượt quy định
    const sizeConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'MAX_GROUP_SIZE', semesterId: group.semesterId },
    });
    const maxSize = typeof sizeConfig?.value === 'number' ? sizeConfig.value : 3;
    const effectiveMax = group.topic?.capacity ? Math.min(group.topic.capacity, maxSize) : maxSize;

    if (group.members.length >= effectiveMax) {
      throw new BadRequestException(`Nhóm đã đủ số lượng thành viên tối đa theo quy định (${effectiveMax} sinh viên)`);
    }

    // 2. Check SV không thuộc 2 nhóm trong cùng học kỳ
    const existingInOtherGroup = await this.prisma.groupMember.findFirst({
      where: {
        studentId: dto.studentId,
        group: {
          semesterId: group.semesterId,
          status: { not: 'CANCELLED' },
        },
      },
      include: { group: true },
    });

    if (existingInOtherGroup) {
      throw new ConflictException(
        existingInOtherGroup.groupId === groupId
          ? 'Sinh viên đã thuộc nhóm này'
          : `Sinh viên đã thuộc nhóm khác (${existingInOtherGroup.group.code}) trong học kỳ này, không được tham gia 2 nhóm`,
      );
    }

    if (dto.isLeader) {
      await this.prisma.groupMember.updateMany({
        where: { groupId },
        data: { isLeader: false },
      });
    }

    const createdMember = await this.prisma.groupMember.create({
      data: {
        groupId,
        studentId: dto.studentId,
        isLeader: dto.isLeader ?? (group.members.length === 0),
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } },
          },
        },
      },
    });

    if (group.topicId) {
      await this.prisma.registration.updateMany({
        where: {
          studentId: dto.studentId,
          topicId: group.topicId,
          status: { in: ['APPROVED', 'CHO_XAC_NHAN'] },
        },
        data: { groupId },
      });
    }

    return createdMember;
  }

  async update(userId: string, groupId: string, dto: UpdateGroupDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        topic: { select: { id: true, ownerId: true, capacity: true, title: true } },
        members: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
        semester: true,
      },
    });

    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // 1. Phân quyền cập nhật ("khi được phép")
    const isManager = await this.isManager(userId);
    const isAdvisor = group.topic?.ownerId === userId;
    const isLeader = group.members.some((m) => m.student.userId === userId && m.isLeader);

    if (!isManager && !isAdvisor && !isLeader) {
      throw new ForbiddenException('Bạn không có quyền cập nhật thông tin nhóm này');
    }

    // Nếu nhóm đã hủy hoặc đã hoàn thành, chỉ manager mới có thể sửa
    if ((group.status === 'CANCELLED' || group.status === 'COMPLETED') && !isManager) {
      throw new BadRequestException('Không thể chỉnh sửa nhóm đã hoàn thành hoặc đã hủy');
    }

    // Nếu là sinh viên (trưởng nhóm):
    if (isLeader && !isManager && !isAdvisor) {
      if (dto.status && dto.status !== group.status) {
        throw new ForbiddenException('Sinh viên không có quyền thay đổi trạng thái nhóm');
      }
      if (dto.midtermStatus !== undefined || dto.midtermNote !== undefined) {
        throw new ForbiddenException('Sinh viên không có quyền cập nhật đánh giá giữa kỳ');
      }
      if (dto.topicId && dto.topicId !== group.topicId) {
        throw new ForbiddenException('Sinh viên không có quyền trực tiếp gán đổi đề tài nhóm');
      }
      if (
        (dto.memberIds || dto.addStudentId || dto.removeStudentId) &&
        group.status !== 'FORMING'
      ) {
        throw new ForbiddenException(
          'Chỉ có thể thay đổi thành viên khi nhóm đang trong giai đoạn lập nhóm (FORMING)',
        );
      }
    }

    // 2. Quy định số lượng tối đa
    const sizeConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'MAX_GROUP_SIZE', semesterId: group.semesterId },
    });
    const maxSize = typeof sizeConfig?.value === 'number' ? sizeConfig.value : 3;

    // 3. Xử lý đổi đề tài (nếu có)
    let targetTopicCapacity = group.topic?.capacity;
    if (dto.topicId && dto.topicId !== group.topicId) {
      const newTopic = await this.prisma.topic.findUnique({
        where: { id: dto.topicId },
      });
      if (!newTopic) throw new NotFoundException('Đề tài không tồn tại');
      if (newTopic.semesterId !== group.semesterId) {
        throw new BadRequestException('Đề tài không thuộc học kỳ hiện tại của nhóm');
      }
      if (newTopic.status !== 'APPROVED') {
        throw new BadRequestException('Đề tài chưa được phê duyệt');
      }
      targetTopicCapacity = newTopic.capacity;
    }

    const effectiveMax = targetTopicCapacity ? Math.min(targetTopicCapacity, maxSize) : maxSize;

    // 4. Xử lý đồng bộ danh sách thành viên (memberIds)
    if (dto.memberIds) {
      const uniqueMemberIds = Array.from(new Set(dto.memberIds));

      // Kiểm tra số lượng thành viên không vượt quy định
      if (uniqueMemberIds.length > effectiveMax) {
        throw new BadRequestException(
          `Số lượng thành viên không được vượt quá quy định (${effectiveMax} sinh viên)`,
        );
      }

      // Kiểm tra SV không thuộc 2 nhóm trong cùng học kỳ
      for (const sId of uniqueMemberIds) {
        const otherGroup = await this.prisma.groupMember.findFirst({
          where: {
            studentId: sId,
            groupId: { not: groupId },
            group: {
              semesterId: group.semesterId,
              status: { not: 'CANCELLED' },
            },
          },
          include: {
            group: true,
            student: { include: { user: { select: { fullName: true } } } },
          },
        });
        if (otherGroup) {
          const sName = otherGroup.student?.user?.fullName || sId;
          throw new ConflictException(
            `Sinh viên ${sName} đã thuộc nhóm khác (${otherGroup.group.code}) trong học kỳ này, không được tham gia 2 nhóm`,
          );
        }
      }

      // Đảm bảo các sinh viên tồn tại
      const foundStudents = await this.prisma.studentProfile.findMany({
        where: { id: { in: uniqueMemberIds } },
      });
      if (foundStudents.length !== uniqueMemberIds.length) {
        throw new NotFoundException('Một hoặc nhiều sinh viên không tồn tại');
      }

      // Đồng bộ thành viên
      await this.prisma.$transaction(async (tx) => {
        // Xóa các thành viên không còn trong danh sách
        await tx.groupMember.deleteMany({
          where: {
            groupId,
            studentId: { notIn: uniqueMemberIds },
          },
        });

        // Lấy danh sách thành viên hiện còn
        const existingMembers = await tx.groupMember.findMany({
          where: { groupId },
        });
        const existingIds = new Set(existingMembers.map((m) => m.studentId));

        // Thêm thành viên mới
        for (const sId of uniqueMemberIds) {
          if (!existingIds.has(sId)) {
            await tx.groupMember.create({
              data: {
                groupId,
                studentId: sId,
                isLeader: false,
              },
            });
          }
        }

        // Cập nhật trưởng nhóm
        const designatedLeaderId =
          dto.leaderId && uniqueMemberIds.includes(dto.leaderId)
            ? dto.leaderId
            : existingMembers.find((m) => m.isLeader)?.studentId || uniqueMemberIds[0];

        if (designatedLeaderId) {
          await tx.groupMember.updateMany({
            where: { groupId },
            data: { isLeader: false },
          });
          await tx.groupMember.update({
            where: { groupId_studentId: { groupId, studentId: designatedLeaderId } },
            data: { isLeader: true },
          });
        }
      });
    }

    // 5. Xử lý thêm 1 sinh viên (addStudentId)
    if (dto.addStudentId) {
      if (group.members.some((m) => m.studentId === dto.addStudentId)) {
        throw new BadRequestException('Sinh viên đã thuộc nhóm này');
      }
      if (group.members.length + 1 > effectiveMax) {
        throw new BadRequestException(
          `Số lượng thành viên không được vượt quá quy định (${effectiveMax} sinh viên)`,
        );
      }

      const otherGroup = await this.prisma.groupMember.findFirst({
        where: {
          studentId: dto.addStudentId,
          groupId: { not: groupId },
          group: {
            semesterId: group.semesterId,
            status: { not: 'CANCELLED' },
          },
        },
        include: { group: true, student: { include: { user: true } } },
      });
      if (otherGroup) {
        const sName = otherGroup.student?.user?.fullName || dto.addStudentId;
        throw new ConflictException(
          `Sinh viên ${sName} đã thuộc nhóm khác (${otherGroup.group.code}) trong học kỳ này, không được tham gia 2 nhóm`,
        );
      }

      const studentExists = await this.prisma.studentProfile.findUnique({
        where: { id: dto.addStudentId },
      });
      if (!studentExists) throw new NotFoundException('Không tìm thấy sinh viên');

      await this.prisma.groupMember.create({
        data: {
          groupId,
          studentId: dto.addStudentId,
          isLeader: group.members.length === 0,
        },
      });
    }

    // 6. Xử lý xóa 1 sinh viên (removeStudentId)
    if (dto.removeStudentId) {
      const toRemove = group.members.find((m) => m.studentId === dto.removeStudentId);
      if (!toRemove) {
        throw new NotFoundException('Sinh viên không thuộc nhóm này');
      }

      await this.prisma.groupMember.delete({
        where: { groupId_studentId: { groupId, studentId: dto.removeStudentId } },
      });

      // Nếu xóa trưởng nhóm, gán trưởng nhóm cho thành viên còn lại
      if (toRemove.isLeader) {
        const remainingMember = group.members.find((m) => m.studentId !== dto.removeStudentId);
        if (remainingMember) {
          await this.prisma.groupMember.update({
            where: {
              groupId_studentId: { groupId, studentId: remainingMember.studentId },
            },
            data: { isLeader: true },
          });
        }
      }
    }

    // 7. Xử lý chỉ định trưởng nhóm (leaderId đơn lẻ)
    if (dto.leaderId && !dto.memberIds) {
      const isMember = group.members.some((m) => m.studentId === dto.leaderId);
      if (!isMember) {
        throw new BadRequestException('Trưởng nhóm phải là thành viên trong nhóm');
      }

      await this.prisma.$transaction([
        this.prisma.groupMember.updateMany({
          where: { groupId },
          data: { isLeader: false },
        }),
        this.prisma.groupMember.update({
          where: { groupId_studentId: { groupId, studentId: dto.leaderId } },
          data: { isLeader: true },
        }),
      ]);
    }

    // 8. Cập nhật các trường cơ bản của nhóm
    const updateData: any = {};
    if (dto.name !== undefined && dto.name.trim() !== '') {
      updateData.name = dto.name.trim();
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }
    if (dto.topicId !== undefined) {
      updateData.topicId = dto.topicId;
    }
    if (dto.midtermStatus !== undefined) {
      updateData.midtermStatus = dto.midtermStatus;
      updateData.midtermAt = new Date();
    }
    if (dto.midtermNote !== undefined) {
      updateData.midtermNote = dto.midtermNote;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.group.update({
        where: { id: groupId },
        data: updateData,
      });
    }

    return this.findById(groupId, userId);
  }

  async removeMember(userId: string, groupId: string, studentId: string) {
    return this.update(userId, groupId, { removeStudentId: studentId } as UpdateGroupDto);
  }

  async transferMember(
    userId: string,
    fromGroupId: string,
    dto: { studentId: string; targetGroupId: string },
  ) {
    if (!dto.studentId || !dto.targetGroupId) {
      throw new BadRequestException('Vui lòng cung cấp studentId và targetGroupId');
    }
    if (fromGroupId === dto.targetGroupId) {
      throw new BadRequestException('Nhóm chuyển đến phải khác nhóm hiện tại');
    }

    const [fromGroup, targetGroup] = await Promise.all([
      this.prisma.group.findUnique({
        where: { id: fromGroupId },
        include: {
          topic: { select: { id: true, ownerId: true, capacity: true, title: true } },
          members: { include: { student: { include: { user: true } } } },
        },
      }),
      this.prisma.group.findUnique({
        where: { id: dto.targetGroupId },
        include: {
          topic: { select: { id: true, ownerId: true, capacity: true, title: true } },
          members: { include: { student: { include: { user: true } } } },
        },
      }),
    ]);

    if (!fromGroup) throw new NotFoundException('Không tìm thấy nhóm nguồn');
    if (!targetGroup) throw new NotFoundException('Không tìm thấy nhóm đích');

    if (fromGroup.semesterId !== targetGroup.semesterId) {
      throw new BadRequestException('Chỉ có thể chuyển sinh viên giữa các nhóm trong cùng học kỳ');
    }

    const isManager = await this.isManager(userId);
    const isAdvisorOfBoth =
      fromGroup.topic?.ownerId === userId && targetGroup.topic?.ownerId === userId;

    if (!isManager && !isAdvisorOfBoth) {
      throw new ForbiddenException(
        'Chỉ Giảng viên hướng dẫn của cả hai nhóm hoặc Quản lý bộ môn mới có quyền chuyển sinh viên giữa các nhóm',
      );
    }

    const memberInSource = fromGroup.members.find((m) => m.studentId === dto.studentId);
    if (!memberInSource) {
      throw new NotFoundException('Sinh viên không thuộc nhóm nguồn');
    }

    if (targetGroup.status === 'CANCELLED' || targetGroup.status === 'COMPLETED') {
      throw new BadRequestException('Không thể chuyển sinh viên vào nhóm đã hủy hoặc đã hoàn thành');
    }

    const sizeConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'MAX_GROUP_SIZE', semesterId: targetGroup.semesterId },
    });
    const maxSize = typeof sizeConfig?.value === 'number' ? sizeConfig.value : 3;
    const effectiveMax = targetGroup.topic?.capacity
      ? Math.min(targetGroup.topic.capacity, maxSize)
      : maxSize;

    if (targetGroup.members.length >= effectiveMax) {
      throw new BadRequestException(
        `Nhóm đích (${targetGroup.code}) đã đủ số lượng thành viên tối đa (${effectiveMax} sinh viên)`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Xóa khỏi nhóm nguồn
      await tx.groupMember.delete({
        where: {
          groupId_studentId: { groupId: fromGroupId, studentId: dto.studentId },
        },
      });

      // Nếu là trưởng nhóm nguồn, chuyển quyền trưởng nhóm cho thành viên còn lại
      if (memberInSource.isLeader) {
        const remaining = fromGroup.members.find((m) => m.studentId !== dto.studentId);
        if (remaining) {
          await tx.groupMember.update({
            where: {
              groupId_studentId: { groupId: fromGroupId, studentId: remaining.studentId },
            },
            data: { isLeader: true },
          });
        }
      }

      // 2. Thêm vào nhóm đích
      await tx.groupMember.create({
        data: {
          groupId: dto.targetGroupId,
          studentId: dto.studentId,
          isLeader: targetGroup.members.length === 0,
        },
      });

      // 3. Đồng bộ đơn đăng ký đề tài (Registration)
      await tx.registration.updateMany({
        where: {
          studentId: dto.studentId,
          semesterId: targetGroup.semesterId,
          status: { in: ['APPROVED', 'CHO_XAC_NHAN', 'PENDING'] },
        },
        data: {
          groupId: dto.targetGroupId,
          ...(targetGroup.topicId ? { topicId: targetGroup.topicId } : {}),
        },
      });
    });

    return {
      message: `Đã chuyển sinh viên sang nhóm ${targetGroup.code} thành công`,
      fromGroup: await this.findById(fromGroupId, userId),
      targetGroup: await this.findById(dto.targetGroupId, userId),
    };
  }

  async midterm(userId: string, groupId: string, dto: MidtermDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { topic: { select: { ownerId: true } } },
    });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');
    if (group.topic?.ownerId !== userId && !(await this.isManager(userId))) {
      throw new ForbiddenException('Bạn không quản lý nhóm này');
    }
    if (group.status === 'CANCELLED') {
      throw new BadRequestException('Nhóm đã bị hủy, không thể đánh giá giữa kỳ');
    }

    if (dto.status === 'STOPPED') {
      const lockedScores = await this.prisma.score.count({
        where: { groupId, status: 'LOCKED' },
      });
      if (lockedScores > 0) {
        throw new BadRequestException(
          'Nhóm đã khóa điểm chấm chính thức, không thể xử lý lại giữa kỳ sang Dừng đề tài. Vui lòng mở khóa điểm trước.',
        );
      }
      await this.prisma.reviewerAssignment.deleteMany({ where: { groupId } });
      await this.prisma.defenseSchedule.deleteMany({
        where: { groupId, status: { not: 'COMPLETED' } },
      });
    }

    const previousMidtermStatus = group.midtermStatus;
    const isReEvaluation =
      previousMidtermStatus !== 'PENDING' && previousMidtermStatus !== dto.status;
    const now = new Date();

    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        midtermStatus: dto.status,
        midtermNote: dto.note,
        midtermAt: now,
        ...(dto.status === 'CONTINUE' && group.status === 'FORMING' ? { status: 'ACTIVE' } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: isReEvaluation ? 'RE_EVALUATE_MIDTERM' : 'MIDTERM_EVALUATION',
        entity: 'Group',
        entityId: groupId,
        metadata: {
          previousMidtermStatus,
          midtermStatus: dto.status,
          isReEvaluation,
          lyDo: dto.note,
          confirmedBy: userId,
          midtermAt: now,
        },
      },
    });

    return updated;
  }

  async createGroup(userId: string, dto: { topicId: string; name?: string; memberStudentIds?: string[] }) {
    if (!dto.topicId) {
      throw new BadRequestException('Vui lòng cung cấp mã đề tài (topicId)');
    }

    const topic = await this.prisma.topic.findUnique({
      where: { id: dto.topicId },
      include: {
        semester: true,
        groups: { where: { status: { not: 'CANCELLED' } }, include: { members: true } },
      },
    });
    if (!topic) throw new NotFoundException('Không tìm thấy đề tài');

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (student) {
      // Người gọi là Sinh viên
      const myReg = await this.prisma.registration.findFirst({
        where: {
          studentId: student.id,
          topicId: topic.id,
          status: { in: ['APPROVED', 'CHO_XAC_NHAN'] },
        },
      });
      if (!myReg) {
        throw new ForbiddenException('Bạn chưa đăng ký đề tài này để tạo nhóm');
      }

      const existingMembership = await this.prisma.groupMember.findFirst({
        where: {
          studentId: student.id,
          group: { semesterId: topic.semesterId, status: { not: 'CANCELLED' } },
        },
      });
      if (existingMembership) {
        throw new ConflictException('Bạn đã thuộc một nhóm KLTN khác trong học kỳ này');
      }

      let group = topic.groups?.[0] || null;
      if (group) {
        if (group.members.length >= topic.capacity) {
          throw new BadRequestException('Nhóm của đề tài này đã đủ số lượng thành viên tối đa');
        }
        await this.prisma.groupMember.create({
          data: {
            groupId: group.id,
            studentId: student.id,
            isLeader: group.members.length === 0,
          },
        });
        await this.prisma.registration.update({
          where: { id: myReg.id },
          data: { groupId: group.id },
        });
      } else {
        const count = await this.prisma.group.count({ where: { semesterId: topic.semesterId } });
        const semCode = topic.semester?.code || 'KLTN';
        const groupCode = `GRP-${semCode}-${String(count + 1).padStart(3, '0')}`;
        const groupName = dto.name || `Nhóm ${topic.title.substring(0, 45)}`;

        group = await this.prisma.group.create({
          data: {
            code: groupCode,
            name: groupName,
            topicId: topic.id,
            semesterId: topic.semesterId,
            status: 'ACTIVE',
          },
          include: { members: true },
        });

        await this.prisma.groupMember.create({
          data: {
            groupId: group.id,
            studentId: student.id,
            isLeader: true,
          },
        });

        await this.prisma.registration.update({
          where: { id: myReg.id },
          data: { groupId: group.id },
        });
      }

      // Thêm các thành viên được chọn cùng đăng ký đề tài này
      if (Array.isArray(dto.memberStudentIds) && dto.memberStudentIds.length > 0) {
        for (const mId of dto.memberStudentIds) {
          if (mId === student.id) continue;
          const currentCount = await this.prisma.groupMember.count({ where: { groupId: group.id } });
          if (currentCount >= topic.capacity) break;

          const targetReg = await this.prisma.registration.findFirst({
            where: {
              studentId: mId,
              topicId: topic.id,
              status: { in: ['APPROVED', 'CHO_XAC_NHAN'] },
            },
          });
          if (targetReg) {
            const alreadyInGroup = await this.prisma.groupMember.findFirst({
              where: { studentId: mId, group: { semesterId: topic.semesterId, status: { not: 'CANCELLED' } } },
            });
            if (!alreadyInGroup) {
              await this.prisma.groupMember.create({
                data: { groupId: group.id, studentId: mId, isLeader: false },
              });
              await this.prisma.registration.update({
                where: { id: targetReg.id },
                data: { groupId: group.id },
              });
            }
          }
        }
      }

      return this.findById(group.id, userId);
    } else {
      // Người gọi là Giảng viên hoặc Quản lý
      const isManager = await this.isManager(userId);
      const isOwner = topic.ownerId === userId;
      if (!isManager && !isOwner) {
        throw new ForbiddenException('Bạn không có quyền tạo nhóm cho đề tài này');
      }

      // Kiểm tra hạn mức hướng dẫn của GVHD trước khi tạo nhóm mới
      if (topic.ownerId) {
        const lecturer = await this.prisma.lecturerProfile.findUnique({
          where: { userId: topic.ownerId },
        });
        if (lecturer) {
          const semesterQuota = await this.prisma.lecturerQuota.findUnique({
            where: {
              lecturerId_semesterId: {
                lecturerId: lecturer.id,
                semesterId: topic.semesterId,
              },
            },
          });
          const maxGroups = semesterQuota?.maxGroups ?? lecturer.maxGroups ?? 5;
          const guidedGroupsCount = await this.prisma.group.count({
            where: {
              topic: { ownerId: topic.ownerId },
              semesterId: topic.semesterId,
              status: { not: 'CANCELLED' },
            },
          });
          if (maxGroups <= 0 || guidedGroupsCount >= maxGroups) {
            throw new ForbiddenException(
              `Giảng viên hướng dẫn đã đạt hạn mức số nhóm tối đa trong học kỳ này (${guidedGroupsCount}/${maxGroups} nhóm). Không thể tạo thêm nhóm mới.`,
            );
          }
        }
      }

      const count = await this.prisma.group.count({ where: { semesterId: topic.semesterId } });
      const semCode = topic.semester?.code || 'KLTN';
      const groupCode = `GRP-${semCode}-${String(count + 1).padStart(3, '0')}`;
      const groupName = dto.name || `Nhóm ${topic.title.substring(0, 45)}`;

      const group = await this.prisma.group.create({
        data: {
          code: groupCode,
          name: groupName,
          topicId: topic.id,
          semesterId: topic.semesterId,
          status: 'ACTIVE',
        },
        include: { members: true },
      });

      if (Array.isArray(dto.memberStudentIds)) {
        for (let i = 0; i < dto.memberStudentIds.length; i++) {
          const sId = dto.memberStudentIds[i];
          if (i >= topic.capacity) break;
          await this.prisma.groupMember.create({
            data: {
              groupId: group.id,
              studentId: sId,
              isLeader: i === 0,
            },
          });
          await this.prisma.registration.updateMany({
            where: {
              studentId: sId,
              topicId: topic.id,
              status: { in: ['APPROVED', 'CHO_XAC_NHAN'] },
            },
            data: { groupId: group.id },
          });
        }
      }

      return this.findById(group.id, userId);
    }
  }

  async joinGroup(userId: string, groupId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!student) throw new ForbiddenException('Không tìm thấy thông tin sinh viên');

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { topic: true, members: true },
    });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');

    if (!group.topicId) {
      throw new BadRequestException('Nhóm chưa được gắn đề tài');
    }

    const myReg = await this.prisma.registration.findFirst({
      where: {
        studentId: student.id,
        topicId: group.topicId,
        status: { in: ['APPROVED', 'CHO_XAC_NHAN'] },
      },
    });
    if (!myReg) {
      throw new ForbiddenException('Bạn phải đăng ký đề tài này trước khi tham gia nhóm');
    }

    const capacity = group.topic?.capacity ?? 2;
    if (group.members.length >= capacity) {
      throw new BadRequestException('Nhóm đã đủ số lượng thành viên tối đa');
    }

    const existingMembership = await this.prisma.groupMember.findFirst({
      where: {
        studentId: student.id,
        group: { semesterId: group.semesterId, status: { not: 'CANCELLED' } },
      },
    });
    if (existingMembership) {
      throw new ConflictException('Bạn đã thuộc một nhóm KLTN khác trong học kỳ này');
    }

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        studentId: student.id,
        isLeader: group.members.length === 0,
      },
    });

    await this.prisma.registration.update({
      where: { id: myReg.id },
      data: { groupId: group.id },
    });

    return this.findById(group.id, userId);
  }

  private async isManager(userId: string) {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return roles.some(
      ({ role }) => role.code === 'TRUONG_BO_MON' || role.code === 'QUAN_LY_BO_MON',
    );
  }
}
