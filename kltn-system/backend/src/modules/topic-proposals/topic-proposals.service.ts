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

    // 4. Create TopicProposal with status CHO_GV_XAC_NHAN
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
      `Sinh viên ${student.user?.fullName} (${student.studentCode}) đã gửi đề xuất đề tài: "${dto.tenDeTai}". Vui lòng xem xét và phản hồi.`,
      'REGISTRATION',
    );

    // Notification for Student
    await this.notifications.create(
      userId,
      'Đã gửi đề xuất đề tài KLTN',
      `Đề xuất đề tài "${dto.tenDeTai}" đã được gửi tới GVHD ${lecturer.user?.fullName}. Trạng thái: Chờ GV xác nhận (CHO_GV_XAC_NHAN).`,
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

      const activeTopicsCount = await this.prisma.topic.count({
        where: {
          ownerId: proposal.lecturer.userId,
          semesterId: proposal.semesterId,
          status: { in: ['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'PENDING_APPROVAL', 'APPROVED', 'CAN_CAP_NHAT'] },
        },
      });

      const currentLoad = Math.max(guidedGroupsCount, activeTopicsCount);
      if (currentLoad >= maxGroups) {
        throw new ForbiddenException(
          `Bạn đã đạt số nhóm tối đa được phép hướng dẫn trong học kỳ này (hạn mức: ${maxGroups} nhóm). Không thể nhận thêm đề tài/sinh viên.`,
        );
      }

      // 1. Update proposal status
      const updatedProposal = await this.prisma.topicProposal.update({
        where: { id: proposalId },
        data: { status: 'GV_DA_DUYET' },
      });

      // 2. Create Topic for Department Head approval or registration
      const createdTopic = await this.prisma.topic.create({
        data: {
          title: proposal.tenDeTai,
          summary: proposal.moTa,
          objectives: proposal.yeuCau,
          technologies: 'Đề xuất sinh viên',
          capacity: 2,
          status: 'APPROVED',
          ownerId: proposal.lecturer.userId,
          semesterId: proposal.semesterId,
          departmentId: proposal.student.departmentId,
        },
      });

      // 3. Create approved registration
      await this.prisma.registration.create({
        data: {
          studentId: proposal.studentId,
          semesterId: proposal.semesterId,
          topicId: createdTopic.id,
          status: 'APPROVED',
        },
      });

      // 4. Notify student
      await this.notifications.create(
        proposal.student.userId,
        'Đề xuất đề tài KLTN đã được duyệt',
        `GVHD ${proposal.lecturer.user?.fullName} đã chấp nhận đề xuất đề tài "${proposal.tenDeTai}" của bạn và đưa vào danh mục chính thức!`,
        'REGISTRATION',
      );

      return {
        proposal: updatedProposal,
        topic: createdTopic,
        message: 'Đã chấp nhận đề xuất đề tài thành công',
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
