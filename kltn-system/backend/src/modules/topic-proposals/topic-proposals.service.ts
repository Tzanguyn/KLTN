import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTopicProposalDto } from './dto/create-topic-proposal.dto';
import { DecideTopicProposalDto } from './dto/decide-topic-proposal.dto';
import { SemestersService } from '../semesters/semesters.service';

@Injectable()
export class TopicProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly semestersService: SemestersService,
  ) {}

  async create(userId: string, dto: CreateTopicProposalDto) {
    // 1. Check student profile existence (E3: 403)
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!student) {
      throw new ForbiddenException('Không tìm thấy hồ sơ sinh viên');
    }

    // 2. Check student does not already have an active registration or group
    const activeSem = await this.prisma.semester.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });
    if (!activeSem) {
      throw new BadRequestException('Chưa có học kỳ nào mở đăng ký KLTN');
    }

    const now = new Date();
    if (activeSem.registrationFrom && now < activeSem.registrationFrom) {
      throw new ForbiddenException('Chưa đến thời gian mở đăng ký KLTN');
    }
    if (activeSem.registrationTo && now > activeSem.registrationTo) {
      throw new ForbiddenException('Đã hết thời gian đăng ký đề tài KLTN');
    }

    // Tự động kiểm tra điều kiện đăng ký KLTN theo đợt (tín chỉ, GPA, môn tiên quyết, eligible)
    await this.semestersService.assertStudentMeetsConditions(activeSem.id, student);

    const existingRegistration = await this.prisma.registration.findFirst({
      where: {
        studentId: student.id,
        semesterId: activeSem.id,
        status: { in: ['PENDING', 'CHO_XAC_NHAN', 'APPROVED'] },
      },
    });
    const existingGroup = await this.prisma.groupMember.findFirst({
      where: {
        studentId: student.id,
        group: {
          semesterId: activeSem.id,
          status: { not: 'CANCELLED' },
        },
      },
    });

    if (existingRegistration || existingGroup) {
      throw new ConflictException('Bạn đã đăng ký hoặc thuộc một đề tài khác');
    }

    // 3. Find Lecturer (GVHD)
    const lecturer = await this.prisma.lecturerProfile.findFirst({
      where: {
        OR: [{ id: dto.gvhdId }, { userId: dto.gvhdId }],
      },
      include: { user: true },
    });
    if (!lecturer) {
      throw new NotFoundException('Giảng viên hướng dẫn không tồn tại trong hệ thống');
    }

    // 4. Create TopicProposal with status CHO_GV_XAC_NHAN (Chờ GVHD xác nhận trước khi trình Trưởng bộ môn)
    const proposal = await this.prisma.topicProposal.create({
      data: {
        studentId: student.id,
        lecturerId: lecturer.id,
        semesterId: activeSem.id,
        tenDeTai: dto.tenDeTai.trim(),
        moTa: dto.moTa.trim(),
        yeuCau: dto.yeuCau.trim(),
        status: 'CHO_GV_XAC_NHAN',
      },
      include: {
        student: { include: { user: true } },
        lecturer: { include: { user: true } },
        semester: true,
      },
    });

    // 5. Emit Notifications
    // Notification for GVHD
    await this.notifications.create(
      lecturer.userId,
      'Đề xuất đề tài KLTN mới từ sinh viên',
      `Sinh viên ${student.user?.fullName} (${student.studentCode}) đã gửi đề xuất đề tài: "${dto.tenDeTai}". Vui lòng xác nhận đồng ý hướng dẫn để chuyển đề tài lên Trưởng bộ môn phê duyệt.`,
      'REGISTRATION',
    );

    // Notification for Student
    await this.notifications.create(
      userId,
      'Đã gửi đề xuất đề tài KLTN',
      `Đề xuất đề tài "${dto.tenDeTai}" đã được gửi tới GVHD ${lecturer.user?.fullName}. Sau khi GVHD xác nhận đồng ý, đề tài sẽ được chuyển tới Trưởng bộ môn phê duyệt.`,
      'REGISTRATION',
    );

    return proposal;
  }

  async findMyProposals(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return [];

    return this.prisma.topicProposal.findMany({
      where: { studentId: student.id },
      include: {
        lecturer: {
          include: {
            user: {
              select: { fullName: true, email: true, phone: true },
            },
          },
        },
        semester: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLecturerProposals(userId: string) {
    const lecturer = await this.prisma.lecturerProfile.findUnique({ where: { userId } });
    if (!lecturer) return [];

    return this.prisma.topicProposal.findMany({
      where: { lecturerId: lecturer.id },
      include: {
        student: {
          include: {
            user: {
              select: { fullName: true, email: true, phone: true },
            },
          },
        },
        semester: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async decide(proposalId: string, lecturerUserId: string, dto: DecideTopicProposalDto) {
    const proposal = await this.prisma.topicProposal.findUnique({
      where: { id: proposalId },
      include: {
        student: { include: { user: true } },
        lecturer: { include: { user: true } },
        semester: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException('Không tìm thấy đề xuất đề tài');
    }

    if (proposal.lecturer.userId !== lecturerUserId) {
      throw new ForbiddenException('Bạn không có quyền xét duyệt đề xuất đề tài này');
    }

    // Tìm đề tài tương ứng với đề xuất này (nếu đã tạo khi sinh viên gửi đề xuất)
    const existingTopic = await this.prisma.topic.findFirst({
      where: {
        title: proposal.tenDeTai,
        semesterId: proposal.semesterId,
        ownerId: proposal.lecturer.userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (dto.status === 'GV_DA_DUYET') {
      const semesterQuota = await this.prisma.lecturerQuota.findUnique({
        where: {
          lecturerId_semesterId: {
            lecturerId: proposal.lecturer.id,
            semesterId: proposal.semesterId,
          },
        },
      });
      const maxGroups = semesterQuota?.maxGroups ?? proposal.lecturer.maxGroups ?? 5;

      const guidedGroupsCount = await this.prisma.group.count({
        where: {
          topic: { ownerId: proposal.lecturer.userId },
          semesterId: proposal.semesterId,
          status: { not: 'CANCELLED' },
        },
      });

      const chosenTopicsCount = await this.prisma.topic.count({
        where: {
          ownerId: proposal.lecturer.userId,
          semesterId: proposal.semesterId,
          status: { in: ['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'PENDING_APPROVAL', 'APPROVED', 'CAN_CAP_NHAT'] },
          ...(existingTopic ? { id: { not: existingTopic.id } } : {}),
          OR: [
            { groups: { some: { status: { not: 'CANCELLED' } } } },
            { registrations: { some: { status: { in: ['PENDING', 'CHO_XAC_NHAN', 'APPROVED'] } } } },
          ],
        },
      });

      const currentLoad = Math.max(guidedGroupsCount, chosenTopicsCount);
      if (currentLoad >= maxGroups) {
        throw new ForbiddenException(
          `Bạn đã đạt số nhóm tối đa được phép hướng dẫn trong học kỳ này (đang hướng dẫn ${currentLoad}/${maxGroups} nhóm). Không thể nhận thêm đề tài/sinh viên.`,
        );
      }

      // 1. Update proposal status
      const updatedProposal = await this.prisma.topicProposal.update({
        where: { id: proposalId },
        data: { status: 'GV_DA_DUYET' },
      });

      // 2. Đảm bảo có bản ghi Topic ở trạng thái CHO_DUYET chờ Trưởng bộ môn phê duyệt
      let targetTopic = existingTopic;
      if (!targetTopic) {
        targetTopic = await this.prisma.topic.create({
          data: {
            title: proposal.tenDeTai,
            summary: proposal.moTa,
            objectives: proposal.yeuCau,
            technologies: 'Đề xuất sinh viên',
            capacity: 2,
            status: 'CHO_DUYET',
            ownerId: proposal.lecturer.userId,
            semesterId: proposal.semesterId,
            departmentId: proposal.student.departmentId,
          },
        });
      } else if (targetTopic.status !== 'APPROVED') {
        targetTopic = await this.prisma.topic.update({
          where: { id: targetTopic.id },
          data: {
            status: 'CHO_DUYET',
            technologies: targetTopic.technologies || 'Đề xuất sinh viên',
          },
        });
      }

      // 3. Đảm bảo có bản ghi đăng ký của sinh viên gắn với đề tài này
      const existingReg = await this.prisma.registration.findFirst({
        where: {
          studentId: proposal.studentId,
          semesterId: proposal.semesterId,
          topicId: targetTopic.id,
        },
      });
      if (!existingReg) {
        await this.prisma.registration.create({
          data: {
            studentId: proposal.studentId,
            semesterId: proposal.semesterId,
            topicId: targetTopic.id,
            proposal: `Đề xuất từ sinh viên: ${proposal.tenDeTai}`,
            status: targetTopic.status === 'APPROVED' ? 'APPROVED' : 'CHO_XAC_NHAN',
          },
        });
      }

      // 4. Notify student & Department Head
      await this.notifications.create(
        proposal.student.userId,
        'GVHD đã đồng ý hướng dẫn đề tài đề xuất',
        `GVHD ${proposal.lecturer.user?.fullName} đã đồng ý hướng dẫn đề tài "${proposal.tenDeTai}" của bạn. Đề tài đang chờ Trưởng bộ môn phê duyệt chính thức!`,
        'REGISTRATION',
      );

      const heads = await this.prisma.user.findMany({
        where: {
          roles: { some: { role: { name: 'TRUONG_BO_MON' } } },
        },
        select: { id: true },
      });
      for (const head of heads) {
        await this.notifications.create(
          head.id,
          'GVHD đã xác nhận đề tài do Sinh viên đề xuất',
          `GVHD ${proposal.lecturer.user?.fullName} đã đồng ý hướng dẫn đề tài "${proposal.tenDeTai}" của SV ${proposal.student.user?.fullName} (${proposal.student.studentCode}). Vui lòng phê duyệt đề tài.`,
          'REGISTRATION',
        );
      }

      return {
        proposal: updatedProposal,
        topic: targetTopic,
        message: 'Đã xác nhận đồng ý hướng dẫn. Đề tài đã được chuyển tới Trưởng bộ môn phê duyệt!',
      };
    } else {
      // Reject proposal
      const updatedProposal = await this.prisma.topicProposal.update({
        where: { id: proposalId },
        data: {
          status: 'TU_CHOI',
          rejectionReason: dto.reason || 'Chưa phù hợp định hướng nghiên cứu của GVHD',
        },
      });

      if (existingTopic && existingTopic.status !== 'APPROVED') {
        await this.prisma.topic.update({
          where: { id: existingTopic.id },
          data: {
            status: 'REJECTED',
            rejectionReason: dto.reason || 'GVHD từ chối hướng dẫn đề xuất đề tài của sinh viên',
          },
        });
        await this.prisma.registration.updateMany({
          where: {
            topicId: existingTopic.id,
            studentId: proposal.studentId,
          },
          data: {
            status: 'REJECTED',
            decisionNote: dto.reason || 'GVHD từ chối đề xuất đề tài',
            decidedAt: new Date(),
          },
        });
      }

      // Notify student
      await this.notifications.create(
        proposal.student.userId,
        'Đề xuất đề tài KLTN bị từ chối',
        `GVHD ${proposal.lecturer.user?.fullName} đã từ chối đề xuất "${proposal.tenDeTai}". Lý do: ${
          dto.reason || 'Chưa phù hợp định hướng nghiên cứu'
        }`,
        'REGISTRATION',
      );

      return {
        proposal: updatedProposal,
        message: 'Đã từ chối đề xuất đề tài',
      };
    }
  }
}
