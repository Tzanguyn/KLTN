import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationDecisionDto } from './dto/decision.dto';
import { CancelRegistrationDto } from './dto/cancel-registration.dto';
import { QueryRegistrationsDto } from './dto/query-registrations.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SemestersService } from '../semesters/semesters.service';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly semestersService: SemestersService,
  ) {}

  async create(userId: string, dto: CreateRegistrationDto) {
    // 1. Pre-condition & E3: Check student existence
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { fullName: true, email: true } },
      },
    });
    if (!student) {
      throw new ForbiddenException('Không tìm thấy thông tin sinh viên');
    }

    // 2. Resolve Topic & Semester
    let topic: any = null;
    let semesterId = dto.semesterId;

    if (dto.topicId) {
      topic = await this.prisma.topic.findUnique({
        where: { id: dto.topicId },
        include: {
          owner: { select: { id: true, fullName: true, email: true } },
          semester: true,
        },
      });

      if (!topic) {
        throw new NotFoundException('Đề tài không tồn tại');
      }

      if (topic.status !== 'APPROVED') {
        throw new BadRequestException('Đề tài chưa được phê duyệt hoặc không còn khả dụng');
      }

      if (!semesterId) {
        semesterId = topic.semesterId;
      }
    }

    if (!semesterId) {
      const activeSem = await this.prisma.semester.findFirst({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      });
      if (!activeSem) {
        throw new BadRequestException('Chưa có học kỳ nào mở đăng ký KLTN');
      }
      semesterId = activeSem.id;
    }

    const semester = await this.prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester || semester.status !== 'OPEN') {
      throw new ForbiddenException('Đợt KLTN chưa mở hoặc đã đóng đăng ký');
    }

    const now = new Date();
    if (semester.registrationFrom && now < semester.registrationFrom) {
      throw new ForbiddenException('Chưa đến thời gian mở đăng ký KLTN');
    }
    if (semester.registrationTo && now > semester.registrationTo) {
      throw new ForbiddenException('Đã hết thời gian đăng ký đề tài KLTN');
    }

    // Tự động kiểm tra điều kiện đăng ký KLTN theo cấu hình của đợt (tín chỉ, GPA, môn tiên quyết, eligible)
    await this.semestersService.assertStudentMeetsConditions(semesterId, student);

    // 3. Pre-condition & E2: Check student does not already have an active registration or group
    const existingActiveRegistration = await this.prisma.registration.findFirst({
      where: {
        studentId: student.id,
        semesterId,
        status: { in: ['PENDING', 'CHO_XAC_NHAN', 'APPROVED'] },
      },
    });
    const existingGroupMembership = await this.prisma.groupMember.findFirst({
      where: {
        studentId: student.id,
        group: {
          semesterId,
          status: { not: 'CANCELLED' },
        },
      },
    });

    if (existingActiveRegistration || existingGroupMembership) {
      throw new ConflictException('Bạn đã đăng ký hoặc thuộc một đề tài khác');
    }

    // 4. Pre-condition & E1: Check topic availability and capacity
    if (topic) {
      const occupiedRegistrations = await this.prisma.registration.findMany({
        where: {
          topicId: topic.id,
          status: { in: ['PENDING', 'CHO_XAC_NHAN', 'APPROVED'] },
        },
        select: { studentId: true },
      });

      const groupMembers = await this.prisma.groupMember.findMany({
        where: {
          group: {
            topicId: topic.id,
            status: { not: 'CANCELLED' },
          },
        },
        select: { studentId: true },
      });

      const uniqueOccupiedStudents = new Set<string>();
      occupiedRegistrations.forEach((r) => uniqueOccupiedStudents.add(r.studentId));
      groupMembers.forEach((m) => uniqueOccupiedStudents.add(m.studentId));

      if (uniqueOccupiedStudents.size >= topic.capacity) {
        throw new ConflictException('Đề tài đã đủ số lượng sinh viên');
      }
    }

    // 5. Post-condition: Create Registration with status CHO_XAC_NHAN
    const created = await this.prisma.registration.create({
      data: {
        studentId: student.id,
        semesterId,
        topicId: dto.topicId,
        proposal: dto.proposal,
        status: 'CHO_XAC_NHAN',
      },
      include: {
        topic: {
          include: {
            owner: { select: { id: true, fullName: true, email: true } },
          },
        },
        semester: true,
        student: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    // 6. Post-condition: Emit notifications
    const topicTitle = topic?.title ?? dto.proposal ?? 'Đề tài KLTN';
    await this.notifications.create(
      userId,
      'Đăng ký đề tài KLTN thành công',
      `Bạn đã gửi yêu cầu đăng ký đề tài "${topicTitle}". Trạng thái hiện tại: Chờ xác nhận (CHO_XAC_NHAN).`,
      'REGISTRATION',
    );

    if (topic?.ownerId) {
      await this.notifications.create(
        topic.ownerId,
        'Có sinh viên đăng ký đề tài hướng dẫn',
        `Sinh viên ${student.user?.fullName} (${student.studentCode}) đã đăng ký đề tài "${topicTitle}". Vui lòng kiểm tra và xác nhận.`,
        'REGISTRATION',
      );
    }

    return created;
  }

  async mine(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    return student
      ? this.prisma.registration.findMany({
          where: { studentId: student.id },
          include: {
            topic: {
              include: {
                owner: { select: { id: true, fullName: true, email: true } },
              },
            },
            semester: true,
            group: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];
  }

  async list(query?: QueryRegistrationsDto | string) {
    const where: any = {};

    let status: string | undefined;
    let semesterId: string | undefined;
    let lop: string | undefined;
    let nganh: string | undefined;

    if (typeof query === 'string') {
      status = query;
    } else if (query) {
      status = query.status;
      semesterId = query.semesterId;
      lop = query.lop;
      nganh = query.nganh;
    }

    if (status) {
      where.status = status as any;
    }

    if (semesterId) {
      where.semesterId = semesterId;
    }

    const studentWhere: any = {};
    if (lop) {
      studentWhere.className = { contains: lop, mode: 'insensitive' };
    }

    if (nganh) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nganh);
      if (isUuid) {
        studentWhere.departmentId = nganh;
      } else {
        studentWhere.department = {
          OR: [
            { code: { contains: nganh, mode: 'insensitive' } },
            { name: { contains: nganh, mode: 'insensitive' } },
          ],
        };
      }
    }

    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    return this.prisma.registration.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } },
            department: { select: { id: true, code: true, name: true } },
          },
        },
        topic: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                lecturerProfile: { select: { id: true, title: true, lecturerCode: true } },
              },
            },
          },
        },
        semester: true,
        group: {
          include: {
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
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async decide(id: string, dto: RegistrationDecisionDto) {
    const existing = await this.prisma.registration.findUnique({
      where: { id },
      include: { topic: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy đăng ký');

    if (dto.status === 'APPROVED') {
      const lecturerUserId = existing.topic?.ownerId;
      if (lecturerUserId) {
        const lecturer = await this.prisma.lecturerProfile.findUnique({
          where: { userId: lecturerUserId },
        });
        if (lecturer) {
          const semesterQuota = await this.prisma.lecturerQuota.findUnique({
            where: {
              lecturerId_semesterId: {
                lecturerId: lecturer.id,
                semesterId: existing.semesterId,
              },
            },
          });
          const maxGroups = semesterQuota?.maxGroups ?? lecturer.maxGroups ?? 5;
          const guidedGroupsCount = await this.prisma.group.count({
            where: {
              topic: { ownerId: lecturerUserId },
              semesterId: existing.semesterId,
              status: { not: 'CANCELLED' },
            },
          });
          if (guidedGroupsCount >= maxGroups) {
            throw new ForbiddenException(
              `Giảng viên đã đạt hạn mức số nhóm tối đa trong học kỳ này (${maxGroups} nhóm). Không thể tiếp nhận thêm sinh viên.`,
            );
          }
        }
      }
    }

    const updated = await this.prisma.registration.update({
      where: { id },
      data: { status: dto.status, decisionNote: dto.note, decidedAt: new Date() },
    });
    const student = await this.prisma.studentProfile.findUnique({ where: { id: existing.studentId } });
    if (student) {
      const topicTitle = existing.topic?.title ?? 'Đề tài KLTN';
      const statusText = dto.status === 'APPROVED' ? 'chấp thuận (APPROVED)' : 'từ chối (REJECTED)';
      await this.notifications.create({
        userId: student.userId,
        title: 'Cập nhật trạng thái đăng ký đề tài KLTN',
        content: `Đơn đăng ký đề tài "${topicTitle}" của bạn đã được ${statusText}.${dto.note ? ` Ghi chú: ${dto.note}` : ''}`,
        type: 'REGISTRATION',
        data: { registrationId: id, status: dto.status, note: dto.note },
        sendEmail: true,
      });
    }
    return updated;
  }

  async cancel(userId: string, id: string, dto?: CancelRegistrationDto) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!student) {
      throw new NotFoundException('Không tìm thấy thông tin sinh viên');
    }

    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        topic: {
          include: {
            owner: { select: { id: true, fullName: true, email: true } },
          },
        },
        semester: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Đơn đăng ký không tồn tại');
    }

    if (registration.studentId !== student.id) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn đăng ký này');
    }

    // Ngoại lệ: GV đã xác nhận chính thức -> 403 "Vui lòng liên hệ GVHD/Quản lý"
    if (registration.status === 'APPROVED') {
      throw new ForbiddenException('Vui lòng liên hệ GVHD/Quản lý');
    }

    // Tiền điều kiện: status cho phép hủy (CHO_XAC_NHAN hoặc PENDING)
    if (!['CHO_XAC_NHAN', 'PENDING'].includes(registration.status)) {
      throw new BadRequestException('Đơn đăng ký không ở trạng thái cho phép hủy');
    }

    // Tiền điều kiện: còn trong thời hạn
    // Ngoại lệ: Quá hạn -> 403
    const semester = registration.semester;
    if (!semester || semester.status !== 'OPEN') {
      throw new ForbiddenException('Đợt KLTN chưa mở hoặc đã đóng đăng ký');
    }

    const now = new Date();
    if (semester.registrationTo && now > semester.registrationTo) {
      throw new ForbiddenException('Đã hết thời hạn đăng ký / hủy đăng ký KLTN');
    }

    // Update status = DA_HUY
    const updated = await this.prisma.registration.update({
      where: { id },
      data: {
        status: 'DA_HUY',
        decisionNote: dto?.reason?.trim() || 'Sinh viên đã hủy / rút đăng ký',
        decidedAt: new Date(),
      },
      include: {
        topic: {
          include: {
            owner: { select: { id: true, fullName: true, email: true } },
          },
        },
        semester: true,
        student: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    // Hoàn trả chỗ trống (nếu có nhóm tạm thời nào đã liên kết, xóa groupMember)
    if (registration.topicId) {
      await this.prisma.groupMember.deleteMany({
        where: {
          studentId: student.id,
          group: {
            topicId: registration.topicId,
            semesterId: registration.semesterId,
            status: { not: 'COMPLETED' },
          },
        },
      });
    }

    // Notification cho GVHD
    let gvhdUserId: string | null = null;
    if (registration.topic?.ownerId) {
      gvhdUserId = registration.topic.ownerId;
    } else if (registration.lecturerId) {
      const lec = await this.prisma.lecturerProfile.findUnique({
        where: { id: registration.lecturerId },
      });
      if (lec) gvhdUserId = lec.userId;
    }

    const topicTitle = registration.topic?.title ?? registration.proposal ?? 'Đề tài KLTN';
    const studentName = student.user?.fullName ?? 'Sinh viên';
    const studentCode = student.studentCode ? ` (${student.studentCode})` : '';

    if (gvhdUserId) {
      await this.notifications.create(
        gvhdUserId,
        'Sinh viên đã hủy đăng ký đề tài',
        `Sinh viên ${studentName}${studentCode} đã hủy / rút đăng ký đề tài "${topicTitle}". Chỗ trống của đề tài đã được hoàn trả.`,
        'REGISTRATION',
      );
    }

    // Notification cho sinh viên
    await this.notifications.create(
      userId,
      'Hủy đăng ký đề tài thành công',
      `Bạn đã hủy / rút đăng ký đề tài "${topicTitle}".`,
      'REGISTRATION',
    );

    return updated;
  }

  async withdraw(userId: string, id: string, dto?: CancelRegistrationDto) {
    return this.cancel(userId, id, dto);
  }
}

