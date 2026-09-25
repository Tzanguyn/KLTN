import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { ReviewTopicDto } from './dto/review-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { ToggleHideTopicDto } from './dto/toggle-hide-topic.dto';
import { AddStudentToTopicDto } from './dto/add-student-to-topic.dto';
import { ApproveTopicDto } from './dto/approve-topic.dto';
import { RejectTopicDto } from './dto/reject-topic.dto';
import { RequestChangesTopicDto } from './dto/request-changes-topic.dto';

@Injectable()
export class TopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    query: {
      page?: number | string;
      limit?: number | string;
      search?: string;
      keyword?: string;
      semesterId?: string;
      status?: string;
      hasSlot?: string | boolean;
      gvId?: string;
      lecturerId?: string;
      chuyenNganh?: string;
      departmentId?: string;
      includeHidden?: string | boolean;
    },
    currentUserId?: string,
  ) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const searchTerm = (query.keyword || query.search || '').trim();
    const gvId = query.gvId || query.lecturerId;
    const chuyenNganh = query.chuyenNganh || query.departmentId;
    const hasSlotFilter = query.hasSlot === 'true' || query.hasSlot === true;

    // Check active semester & registration status
    const currentSemester = await this.prisma.semester.findFirst({
      where: query.semesterId ? { id: query.semesterId } : { status: { in: ['OPEN', 'DRAFT'] } },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    let registrationOpen = false;
    if (currentSemester) {
      const from = currentSemester.registrationFrom ? new Date(currentSemester.registrationFrom) : null;
      const to = currentSemester.registrationTo ? new Date(currentSemester.registrationTo) : null;
      if (from && to) {
        registrationOpen = now >= from && now <= to;
      } else {
        registrationOpen = currentSemester.status === 'OPEN';
      }
    }

    const where: any = {};
    if (query.includeHidden !== 'true' && query.includeHidden !== true) {
      where.isHidden = false;
    }
    if (query.semesterId) {
      where.semesterId = query.semesterId;
    }
    if (query.status) {
      if (['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'PENDING_APPROVAL'].includes(query.status)) {
        where.status = { in: ['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'PENDING_APPROVAL'] };
      } else {
        where.status = query.status as any;
      }
    }
    if (gvId) {
      where.ownerId = gvId;
    }
    if (chuyenNganh) {
      where.OR = [
        { departmentId: chuyenNganh },
        { department: { code: { equals: chuyenNganh, mode: 'insensitive' } } },
        { department: { name: { contains: chuyenNganh, mode: 'insensitive' } } },
      ];
    }

    if (searchTerm) {
      const searchOr = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { technologies: { contains: searchTerm, mode: 'insensitive' } },
        { summary: { contains: searchTerm, mode: 'insensitive' } },
        { objectives: { contains: searchTerm, mode: 'insensitive' } },
        { owner: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }

    // Check if current user has student profile to determine individual registration status
    let currentStudentId: string | undefined;
    if (currentUserId) {
      const studentProfile = await this.prisma.studentProfile.findUnique({ where: { userId: currentUserId } });
      currentStudentId = studentProfile?.id;
    }

    // Fetch topics with relations
    const allMatchingTopics = await this.prisma.topic.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            lecturerProfile: {
              select: {
                title: true,
                specialization: true,
              },
            },
          },
        },
        semester: true,
        department: true,
        registrations: {
          where: { status: { in: ['PENDING', 'CHO_XAC_NHAN', 'APPROVED'] } },
          select: { studentId: true, status: true },
        },
        groups: {
          include: {
            members: { select: { studentId: true } },
          },
        },
      },
    });

    // Compute soLuongDaDangKy & soChoConLai
    const mapped = allMatchingTopics.map((topic) => {
      const registeredStudentIds = new Set<string>();
      let isRegisteredByCurrentUser = false;

      for (const reg of topic.registrations) {
        registeredStudentIds.add(reg.studentId);
        if (currentStudentId && reg.studentId === currentStudentId) {
          isRegisteredByCurrentUser = true;
        }
      }

      for (const group of topic.groups) {
        for (const member of group.members) {
          registeredStudentIds.add(member.studentId);
          if (currentStudentId && member.studentId === currentStudentId) {
            isRegisteredByCurrentUser = true;
          }
        }
      }

      const soLuongDaDangKy = registeredStudentIds.size;
      const soChoConLai = Math.max(0, topic.capacity - soLuongDaDangKy);
      const conCho = soChoConLai > 0;

      let trangThaiDangKy = conCho ? 'CON_CHO' : 'HET_CHO';
      if (isRegisteredByCurrentUser) {
        trangThaiDangKy = 'DA_DANG_KY';
      }

      const gvhdTitle = topic.owner?.lecturerProfile?.title ? `${topic.owner.lecturerProfile.title} ` : '';
      const gvhd = {
        id: topic.owner?.id,
        hoTen: `${gvhdTitle}${topic.owner?.fullName || 'Chưa phân công'}`,
        email: topic.owner?.email || '',
        soDienThoai: topic.owner?.phone || 'Chưa cập nhật',
        hocHamHocVi: topic.owner?.lecturerProfile?.title || 'Giảng viên',
        chuyenMon: topic.owner?.lecturerProfile?.specialization || '',
      };

      const chuyenNganhData = {
        id: topic.department?.id,
        ten: topic.department?.name || 'Khoa Công nghệ Thông tin',
        ma: topic.department?.code || 'CNTT',
      };

      const hocKyData = {
        id: topic.semester?.id,
        ten: topic.semester?.name,
        ma: topic.semester?.code,
        registrationOpen,
      };

      return {
        id: topic.id,
        tenDeTai: topic.title,
        title: topic.title,
        moTa: topic.summary || topic.objectives || '',
        summary: topic.summary,
        yeuCau: topic.objectives || 'Theo yêu cầu của Giảng viên hướng dẫn',
        mucTieu: topic.objectives || '',
        objectives: topic.objectives,
        congNghe: topic.technologies || '',
        technologies: topic.technologies,
        soLuongToiDa: topic.capacity,
        capacity: topic.capacity,
        soLuongDaDangKy,
        soChoConLai,
        conCho,
        trangThai: topic.status,
        status: topic.status,
        trangThaiDangKy,
        gvhd,
        owner: topic.owner,
        chuyenNganh: chuyenNganhData,
        boMon: chuyenNganhData,
        department: topic.department,
        hocKy: hocKyData,
        semester: topic.semester,
        daDangKy: isRegisteredByCurrentUser,
        registrations: topic.registrations,
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
      };
    });

    // Filter hasSlot
    const filtered = hasSlotFilter ? mapped.filter((t) => t.soChoConLai > 0) : mapped;

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      items: paginated,
      meta: {
        page,
        limit,
        total,
        totalPages,
        registrationOpen,
      },
      message: total === 0 ? 'Không tìm thấy đề tài nào phù hợp với bộ lọc' : undefined,
    };
  }

  async create(userId: string, dto: CreateTopicDto) {
    // 1. Ngoại lệ: Thiếu field → 400
    const title = (dto.tenDeTai ?? dto.title ?? '').trim();
    const summary = (dto.moTa ?? dto.summary ?? '').trim();
    const objectives = (dto.yeuCauSinhVien ?? dto.yeuCau ?? dto.objectives ?? '').trim();
    const capacityRaw = dto.soLuongToiDa ?? dto.capacity;
    const technologies = (dto.congNghe ?? dto.technologies ?? '').trim();

    if (!title || !summary || !objectives || capacityRaw === undefined || capacityRaw === null) {
      throw new BadRequestException('Vui lòng điền đầy đủ các thông tin: tên đề tài, mô tả, yêu cầu sinh viên và số lượng tối đa');
    }

    const capacity = Number(capacityRaw);
    if (Number.isNaN(capacity) || capacity <= 0) {
      throw new BadRequestException('Số lượng sinh viên tối đa phải là số nguyên dương lớn hơn 0');
    }

    // 2. Tiền điều kiện: Đã đăng nhập role GiangVien
    const lecturer = await this.prisma.lecturerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!lecturer) {
      throw new ForbiddenException('Chỉ giảng viên mới có quyền đăng ký đề tài KLTN');
    }

    // 3. Tiền điều kiện: Trong thời gian cho phép
    const semester = dto.semesterId
      ? await this.prisma.semester.findUnique({ where: { id: dto.semesterId } })
      : await this.prisma.semester.findFirst({
          where: { status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
        });

    if (!semester) {
      throw new BadRequestException('Chưa có học kỳ nào mở đăng ký KLTN');
    }

    if (semester.status !== 'OPEN') {
      throw new ForbiddenException('Đợt KLTN chưa mở hoặc đã đóng đăng ký');
    }

    const now = new Date();
    if (semester.registrationFrom && now < semester.registrationFrom) {
      throw new ForbiddenException('Chưa đến thời gian mở đăng ký KLTN');
    }
    if (semester.registrationTo && now > semester.registrationTo) {
      throw new ForbiddenException('Đã hết thời gian đăng ký đề tài KLTN');
    }

    // 4. Tiền điều kiện & Ngoại lệ: Chưa vượt hạn mức số nhóm (vượt hạn mức -> 403)
    const semesterQuota = await this.prisma.lecturerQuota.findUnique({
      where: {
        lecturerId_semesterId: {
          lecturerId: lecturer.id,
          semesterId: semester.id,
        },
      },
    });
    const maxGroups = semesterQuota?.maxGroups ?? lecturer.maxGroups ?? 5;

    const guidedGroupsCount = await this.prisma.group.count({
      where: {
        topic: { ownerId: userId },
        semesterId: semester.id,
        status: { not: 'CANCELLED' },
      },
    });

    const activeTopicsCount = await this.prisma.topic.count({
      where: {
        ownerId: userId,
        semesterId: semester.id,
        status: { in: ['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'PENDING_APPROVAL', 'APPROVED', 'CAN_CAP_NHAT'] },
      },
    });

    const currentLoad = Math.max(guidedGroupsCount, activeTopicsCount);
    if (currentLoad >= maxGroups) {
      throw new ForbiddenException('Bạn đã đạt số nhóm tối đa được phép hướng dẫn');
    }

    // 5. Xác định bộ môn
    const departmentId = dto.departmentId || lecturer.departmentId || semester.departmentId;
    if (!departmentId) {
      throw new BadRequestException('Không xác định được bộ môn cho đề tài');
    }

    // 6. Tạo Topic với status = CHO_DUYET
    const createdTopic = await this.prisma.topic.create({
      data: {
        title,
        summary,
        objectives,
        technologies: technologies || null,
        capacity,
        semesterId: semester.id,
        departmentId,
        ownerId: userId,
        status: 'CHO_DUYET',
      },
      include: { semester: true, department: true },
    });

    // 7. Notification cho Trưởng bộ môn
    try {
      let tbms = await this.prisma.user.findMany({
        where: {
          roles: { some: { role: { code: 'TRUONG_BO_MON' } } },
          lecturerProfile: { departmentId },
        },
      });
      if (tbms.length === 0) {
        tbms = await this.prisma.user.findMany({
          where: {
            roles: { some: { role: { code: 'TRUONG_BO_MON' } } },
          },
        });
      }

      const lecturerName = lecturer.user?.fullName || 'Giảng viên';
      for (const tbm of tbms) {
        await this.notifications.create(
          tbm.id,
          'Đề xuất đề tài KLTN mới cần phê duyệt',
          `Giảng viên ${lecturerName} đã đăng ký đề tài mới: "${title}". Vui lòng xem xét và phê duyệt.`,
          'SYSTEM',
          {
            topicId: createdTopic.id,
            semesterId: createdTopic.semesterId,
            lecturerId: lecturer.id,
            topicTitle: title,
          },
          true,
        );
      }
    } catch {
      // Don't fail topic creation if notification encounters issue
    }

    return {
      ...createdTopic,
      tenDeTai: createdTopic.title,
      moTa: createdTopic.summary,
      yeuCauSinhVien: createdTopic.objectives,
      yeuCau: createdTopic.objectives,
      soLuongToiDa: createdTopic.capacity,
      congNghe: createdTopic.technologies,
      status: createdTopic.status,
      trangThai: 'CHO_TRUONG_BM_DUYET',
    };
  }

  async mine(userId: string) {
    const topics = await this.prisma.topic.findMany({
      where: { ownerId: userId },
      include: {
        semester: true,
        department: true,
        approvals: { include: { reviewer: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } },
        registrations: {
          select: { studentId: true, status: true },
        },
        groups: {
          include: {
            members: { select: { studentId: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const now = new Date();
    return topics.map((t) => {
      const registeredStudentIds = new Set<string>();
      const officialStudentIds = new Set<string>();

      for (const reg of t.registrations || []) {
        if (['PENDING', 'CHO_XAC_NHAN', 'APPROVED'].includes(reg.status)) {
          registeredStudentIds.add(reg.studentId);
        }
        if (reg.status === 'APPROVED') {
          officialStudentIds.add(reg.studentId);
        }
      }

      for (const group of t.groups || []) {
        if (group.status !== 'CANCELLED') {
          for (const member of group.members || []) {
            registeredStudentIds.add(member.studentId);
            officialStudentIds.add(member.studentId);
          }
        }
      }

      const soLuongDaDangKy = registeredStudentIds.size;
      const soLuongChinhThuc = officialStudentIds.size;
      const soChoConLai = Math.max(0, t.capacity - soLuongDaDangKy);
      const soChoTrong = soChoConLai;
      const conCho = soChoConLai > 0;

      const isDeadlineExpired = t.semester?.registrationTo ? now > t.semester.registrationTo : false;
      const isSemesterClosed = t.semester?.status ? t.semester.status !== 'OPEN' : false;
      const hasOfficialReg = soLuongChinhThuc > 0;
      const isStatusAllowed = !['ARCHIVED'].includes(t.status);

      const choPhepChinhSua = isStatusAllowed && !hasOfficialReg && !isDeadlineExpired && !isSemesterClosed;

      return {
        ...t,
        tenDeTai: t.title,
        moTa: t.summary,
        yeuCauSinhVien: t.objectives,
        yeuCau: t.objectives,
        congNghe: t.technologies,
        soLuongToiDa: t.capacity,
        soLuongDaDangKy,
        soLuongChinhThuc,
        soChoConLai,
        soChoTrong,
        conCho,
        status: t.status,
        trangThai: t.status === 'PENDING_APPROVAL' || t.status === 'CHO_DUYET' ? 'CHO_TRUONG_BM_DUYET' : t.status,
        isHidden: t.isHidden,
        anDeTai: t.isHidden,
        choPhepChinhSua,
        isEditable: choPhepChinhSua,
      };
    });
  }

  async toggleHide(userId: string, topicId: string, dto: ToggleHideTopicDto) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Không tìm thấy đề tài');
    if (topic.ownerId !== userId) {
      throw new ForbiddenException('Bạn không sở hữu đề tài này');
    }

    const isHidden = dto?.isHidden !== undefined ? dto.isHidden : (dto?.anDeTai !== undefined ? dto.anDeTai : true);

    // Giảng viên chỉ có thể ẩn đề tài đã được duyệt
    if (isHidden && topic.status !== 'APPROVED') {
      throw new BadRequestException('Chỉ có thể ẩn đề tài đã được phê duyệt');
    }

    const updated = await this.prisma.topic.update({
      where: { id: topicId },
      data: { isHidden },
      include: { semester: true, department: true },
    });

    return {
      ...updated,
      tenDeTai: updated.title,
      moTa: updated.summary,
      yeuCauSinhVien: updated.objectives,
      yeuCau: updated.objectives,
      soLuongToiDa: updated.capacity,
      congNghe: updated.technologies,
      status: updated.status,
      trangThai: updated.status,
      isHidden: updated.isHidden,
      anDeTai: updated.isHidden,
      message: isHidden
        ? 'Đã ẩn đề tài khỏi danh sách hiển thị cho sinh viên'
        : 'Đã hiển thị lại đề tài cho sinh viên',
    };
  }

  async update(userId: string, topicId: string, dto: UpdateTopicDto) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        semester: true,
        registrations: {
          select: { studentId: true, status: true },
        },
        groups: {
          include: {
            members: { select: { studentId: true } },
          },
        },
      },
    });
    if (!topic) throw new NotFoundException('Không tìm thấy đề tài');
    if (topic.ownerId !== userId) throw new ForbiddenException('Bạn không sở hữu đề tài này');

    // 1. Kiểm tra status cho phép (chỉ khi status cho phép)
    if (topic.status === 'ARCHIVED') {
      throw new BadRequestException('Đề tài đã lưu trữ hoặc hủy, không thể chỉnh sửa');
    }

    // 2. Không cho sửa sau khi đã có SV đăng ký chính thức
    const officialStudentIds = new Set<string>();
    for (const reg of topic.registrations || []) {
      if (reg.status === 'APPROVED') {
        officialStudentIds.add(reg.studentId);
      }
    }
    for (const group of topic.groups || []) {
      if (group.status !== 'CANCELLED') {
        for (const member of group.members || []) {
          officialStudentIds.add(member.studentId);
        }
      }
    }

    const hasOfficialRegistrations = officialStudentIds.size > 0;
    if (hasOfficialRegistrations) {
      throw new BadRequestException('Không thể chỉnh sửa đề tài sau khi đã có sinh viên đăng ký chính thức');
    }

    // 3. Không cho sửa sau deadline (còn trong thời hạn)
    const semester = topic.semester;
    if (semester) {
      if (semester.status !== 'OPEN') {
        throw new BadRequestException('Học kỳ đã đóng hoặc kết thúc, không thể chỉnh sửa đề tài');
      }
      const now = new Date();
      if (semester.registrationTo && now > semester.registrationTo) {
        throw new BadRequestException('Đã hết thời hạn đăng ký/chỉnh sửa đề tài KLTN');
      }
    }

    // 4. Cập nhật các trường thông tin
    const isHidden = dto.isHidden !== undefined ? dto.isHidden : dto.anDeTai;
    if (isHidden !== undefined && isHidden === true && topic.status !== 'APPROVED') {
      throw new BadRequestException('Chỉ có thể ẩn đề tài đã được phê duyệt');
    }

    const title = (dto.tenDeTai ?? dto.title)?.trim();
    const summary = (dto.moTa ?? dto.summary)?.trim();
    const objectives = (dto.yeuCauSinhVien ?? dto.yeuCau ?? dto.objectives)?.trim();
    const capacityRaw = dto.soLuongToiDa ?? dto.capacity;
    const technologies = (dto.congNghe ?? dto.technologies)?.trim();

    let capacity: number | undefined;
    if (capacityRaw !== undefined && capacityRaw !== null) {
      capacity = Number(capacityRaw);
      if (Number.isNaN(capacity) || capacity <= 0) {
        throw new BadRequestException('Số lượng sinh viên tối đa phải là số nguyên dương');
      }
      const pendingCount = (topic.registrations || []).filter((r) =>
        ['PENDING', 'CHO_XAC_NHAN'].includes(r.status),
      ).length;
      if (capacity < pendingCount) {
        throw new BadRequestException(
          `Số lượng tối đa (${capacity}) không thể nhỏ hơn số sinh viên đang đăng ký (${pendingCount})`,
        );
      }
    }

    const hasContentChange = !!(
      title !== undefined ||
      summary !== undefined ||
      objectives !== undefined ||
      technologies !== undefined ||
      capacity !== undefined
    );
    const newStatus = hasContentChange ? 'CHO_DUYET' : topic.status;

    const updated = await this.prisma.topic.update({
      where: { id: topicId },
      data: {
        ...(title ? { title } : {}),
        ...(summary ? { summary } : {}),
        ...(objectives ? { objectives } : {}),
        ...(technologies !== undefined ? { technologies: technologies || null } : {}),
        ...(capacity !== undefined ? { capacity } : {}),
        ...(isHidden !== undefined ? { isHidden } : {}),
        status: newStatus,
        ...(hasContentChange ? { reviewerId: null, rejectionReason: null } : {}),
      },
      include: { semester: true, department: true },
    });

    return {
      ...updated,
      tenDeTai: updated.title,
      moTa: updated.summary,
      yeuCauSinhVien: updated.objectives,
      yeuCau: updated.objectives,
      soLuongToiDa: updated.capacity,
      congNghe: updated.technologies,
      status: updated.status,
      trangThai: updated.status,
      isHidden: updated.isHidden,
      anDeTai: updated.isHidden,
      message: 'Cập nhật đề tài thành công',
    };
  }

  async remove(userId: string, topicId: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Không tìm thấy đề tài');
    if (topic.ownerId !== userId) throw new ForbiddenException('Bạn không sở hữu đề tài này');
    return this.prisma.topic.update({ where: { id: topicId }, data: { status: 'ARCHIVED' } });
  }

  async findById(topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            lecturerProfile: {
              select: {
                lecturerCode: true,
                title: true,
                specialization: true,
              },
            },
          },
        },
        reviewer: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        semester: true,
        department: true,
        registrations: {
          where: { status: { in: ['PENDING', 'CHO_XAC_NHAN', 'APPROVED'] } },
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
              },
            },
          },
        },
        groups: {
          include: {
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
        },
        approvals: {
          include: {
            reviewer: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException('Không tìm thấy đề tài');
    }

    const registeredStudentIds = new Set<string>();
    for (const reg of topic.registrations) {
      registeredStudentIds.add(reg.studentId);
    }
    for (const group of topic.groups) {
      for (const member of group.members) {
        registeredStudentIds.add(member.studentId);
      }
    }

    const soLuongDaDangKy = registeredStudentIds.size;
    const soChoConLai = Math.max(0, topic.capacity - soLuongDaDangKy);
    const conCho = soChoConLai > 0;

    const gvhdTitle = topic.owner?.lecturerProfile?.title ? `${topic.owner.lecturerProfile.title} ` : '';
    const gvhd = {
      id: topic.owner?.id,
      hoTen: `${gvhdTitle}${topic.owner?.fullName || 'Chưa phân công'}`,
      fullName: topic.owner?.fullName,
      email: topic.owner?.email || '',
      soDienThoai: topic.owner?.phone || 'Chưa cập nhật',
      hocHamHocVi: topic.owner?.lecturerProfile?.title || 'Giảng viên',
      chuyenMon: topic.owner?.lecturerProfile?.specialization || '',
      lecturerCode: topic.owner?.lecturerProfile?.lecturerCode,
    };

    const chuyenNganhData = {
      id: topic.department?.id,
      ten: topic.department?.name || 'Khoa Công nghệ Thông tin',
      ma: topic.department?.code || 'CNTT',
    };

    const hocKyData = {
      id: topic.semester?.id,
      ten: topic.semester?.name,
      ma: topic.semester?.code,
      status: topic.semester?.status,
      registrationFrom: topic.semester?.registrationFrom,
      registrationTo: topic.semester?.registrationTo,
    };

    return {
      id: topic.id,
      title: topic.title,
      tenDeTai: topic.title,
      summary: topic.summary,
      moTa: topic.summary || topic.objectives || '',
      objectives: topic.objectives,
      mucTieu: topic.objectives || '',
      yeuCau: topic.objectives || 'Theo yêu cầu của Giảng viên hướng dẫn',
      technologies: topic.technologies,
      congNghe: topic.technologies || '',
      capacity: topic.capacity,
      soLuongToiDa: topic.capacity,
      soLuongDaDangKy,
      soChoConLai,
      conCho,
      status: topic.status,
      trangThai: topic.status,
      isHidden: topic.isHidden,
      anDeTai: topic.isHidden,
      rejectionReason: topic.rejectionReason,
      lyDoTuChoi: topic.rejectionReason,
      ownerId: topic.ownerId,
      reviewerId: topic.reviewerId,
      departmentId: topic.departmentId,
      semesterId: topic.semesterId,
      owner: topic.owner,
      gvhd,
      reviewer: topic.reviewer,
      department: topic.department,
      boMon: chuyenNganhData,
      chuyenNganh: chuyenNganhData,
      semester: topic.semester,
      hocKy: hocKyData,
      registrations: topic.registrations,
      approvals: topic.approvals,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    };
  }

  async approvalHistory(topicId: string) {
    return this.prisma.topicApproval.findMany({
      where: { topicId },
      include: { reviewer: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(topicId: string, reviewerId: string, dto?: ApproveTopicDto) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Không tìm thấy đề tài');
    if (topic.ownerId === reviewerId) {
      throw new BadRequestException('Không thể tự duyệt đề tài của mình');
    }

    const note = dto?.note || dto?.ghiChu || null;
    const approvalTime = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.topic.update({
        where: { id: topicId },
        data: {
          status: 'APPROVED',
          rejectionReason: null,
          reviewerId,
        },
        include: { owner: true, semester: true, department: true },
      });

      await tx.topicApproval.create({
        data: {
          topicId,
          reviewerId,
          approved: true,
          note,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'APPROVE_TOPIC',
          entity: 'Topic',
          entityId: topic.id,
          metadata: {
            nguoiDuyet: reviewerId,
            thoiGian: approvalTime.toISOString(),
            ketQua: 'APPROVED',
            lyDo: note,
            topicTitle: topic.title,
          },
        },
      });

      try {
        await this.notifications.create(
          topic.ownerId,
          'Đề tài KLTN đã được phê duyệt',
          `Đề tài "${topic.title}" của bạn đã được Trưởng bộ môn phê duyệt đưa vào danh mục đăng ký.${note ? ` Ghi chú: ${note}` : ''}`,
          'SYSTEM',
          { topicId: topic.id, status: 'APPROVED', approved: true, note },
          true,
        );
      } catch {
        // ignore notification error
      }

      return {
        ...updated,
        tenDeTai: updated.title,
        trangThai: updated.status,
        status: updated.status,
        message: 'Phê duyệt đề tài thành công',
      };
    });
  }

  async reject(topicId: string, reviewerId: string, dto: RejectTopicDto) {
    const lyDo = (dto?.lyDo ?? dto?.reason ?? dto?.note ?? '').trim();
    if (!lyDo) {
      throw new BadRequestException('Vui lòng cung cấp lý do từ chối đề tài');
    }

    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Không tìm thấy đề tài');
    if (topic.ownerId === reviewerId) {
      throw new BadRequestException('Không thể tự duyệt đề tài của mình');
    }

    const rejectTime = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.topic.update({
        where: { id: topicId },
        data: {
          status: 'REJECTED',
          rejectionReason: lyDo,
          reviewerId,
        },
        include: { owner: true, semester: true, department: true },
      });

      await tx.topicApproval.create({
        data: {
          topicId,
          reviewerId,
          approved: false,
          note: lyDo,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'REJECT_TOPIC',
          entity: 'Topic',
          entityId: topic.id,
          metadata: {
            nguoiDuyet: reviewerId,
            thoiGian: rejectTime.toISOString(),
            ketQua: 'REJECTED',
            lyDo,
            topicTitle: topic.title,
          },
        },
      });

      try {
        await this.notifications.create(
          topic.ownerId,
          'Đề tài KLTN bị từ chối',
          `Đề tài "${topic.title}" của bạn đã bị từ chối. Lý do: ${lyDo}`,
          'SYSTEM',
          { topicId: topic.id, status: 'REJECTED', approved: false, lyDo },
          true,
        );
      } catch {
        // ignore notification error
      }

      return {
        ...updated,
        tenDeTai: updated.title,
        trangThai: updated.status,
        status: updated.status,
        lyDoTuChoi: lyDo,
        rejectionReason: lyDo,
        message: 'Đã từ chối đề tài',
      };
    });
  }

  async requestChanges(topicId: string, reviewerId: string, dto: RequestChangesTopicDto) {
    const lyDo = (dto?.lyDo ?? dto?.reason ?? dto?.note ?? '').trim();
    if (!lyDo) {
      throw new BadRequestException('Vui lòng cung cấp nội dung/lý do yêu cầu chỉnh sửa đề tài');
    }

    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Không tìm thấy đề tài');
    if (topic.ownerId === reviewerId) {
      throw new BadRequestException('Không thể tự duyệt đề tài của mình');
    }

    const requestTime = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.topic.update({
        where: { id: topicId },
        data: {
          status: 'CAN_CAP_NHAT',
          rejectionReason: lyDo,
          reviewerId,
        },
        include: { owner: true, semester: true, department: true },
      });

      await tx.topicApproval.create({
        data: {
          topicId,
          reviewerId,
          approved: false,
          note: `[Yêu cầu chỉnh sửa] ${lyDo}`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'REQUEST_CHANGES_TOPIC',
          entity: 'Topic',
          entityId: topic.id,
          metadata: {
            nguoiDuyet: reviewerId,
            thoiGian: requestTime.toISOString(),
            ketQua: 'CAN_CAP_NHAT',
            lyDo,
            topicTitle: topic.title,
          },
        },
      });

      try {
        await this.notifications.create(
          topic.ownerId,
          'Yêu cầu chỉnh sửa đề tài KLTN',
          `Đề tài "${topic.title}" của bạn cần được chỉnh sửa/cập nhật. Nội dung yêu cầu: ${lyDo}`,
          'SYSTEM',
          { topicId: topic.id, status: 'CAN_CAP_NHAT', lyDo },
          true,
        );
      } catch {
        // ignore notification error
      }

      return {
        ...updated,
        tenDeTai: updated.title,
        trangThai: updated.status,
        status: updated.status,
        lyDoTuChoi: lyDo,
        rejectionReason: lyDo,
        message: 'Đã gửi yêu cầu chỉnh sửa đề tài cho Giảng viên',
      };
    });
  }

  async review(topicId: string, reviewerId: string, dto: ReviewTopicDto) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Không tìm thấy đề tài');
    if (topic.ownerId === reviewerId) throw new BadRequestException('Không thể tự duyệt đề tài của mình');
    const reviewTime = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.topic.update({
        where: { id: topicId },
        data: {
          status: dto.approved ? 'APPROVED' : 'REJECTED',
          rejectionReason: dto.approved ? null : dto.note,
          reviewerId,
        },
      });
      await tx.topicApproval.create({
        data: {
          topicId,
          reviewerId,
          approved: dto.approved,
          note: dto.note,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: dto.approved ? 'APPROVE_TOPIC' : 'REJECT_TOPIC',
          entity: 'Topic',
          entityId: topic.id,
          metadata: {
            nguoiDuyet: reviewerId,
            thoiGian: reviewTime.toISOString(),
            ketQua: dto.approved ? 'APPROVED' : 'REJECTED',
            lyDo: dto.note || null,
            topicTitle: topic.title,
          },
        },
      });

      // Send notification to topic owner
      try {
        await this.notifications.create(
          topic.ownerId,
          dto.approved ? 'Đề tài KLTN đã được phê duyệt' : 'Đề tài KLTN bị từ chối',
          dto.approved
            ? `Đề tài "${topic.title}" của bạn đã được Trưởng bộ môn phê duyệt đưa vào danh mục đăng ký.`
            : `Đề tài "${topic.title}" của bạn đã bị từ chối. Lý do: ${dto.note || 'Không có lý do cụ thể'}`,
          'SYSTEM',
          { topicId: topic.id, approved: dto.approved },
          true,
        );
      } catch {
        // ignore notification error
      }

      return updated;
    });
  }

  async getRegistrations(userId: string, topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        semester: true,
        registrations: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    avatarUrl: true,
                  },
                },
                department: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        groups: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            members: {
              include: {
                student: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        avatarUrl: true,
                      },
                    },
                    department: {
                      select: { id: true, name: true, code: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException('Không tìm thấy đề tài');
    }

    // Kiểm tra quyền: chủ đề tài hoặc Trưởng/Quản lý bộ môn
    const isOwner = topic.ownerId === userId;
    if (!isOwner) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const hasManagerRole = userRoles.some(
        (ur) => ur.role.code === 'TRUONG_BO_MON' || ur.role.code === 'QUAN_LY_BO_MON',
      );
      if (!hasManagerRole) {
        throw new ForbiddenException('Bạn không sở hữu đề tài này');
      }
    }

    // Tổng hợp danh sách sinh viên đăng ký kèm thông tin liên lạc
    const resultList: any[] = [];
    const seenStudentIds = new Set<string>();

    for (const reg of topic.registrations || []) {
      if (['PENDING', 'CHO_XAC_NHAN', 'APPROVED'].includes(reg.status)) {
        seenStudentIds.add(reg.studentId);
        resultList.push({
          id: reg.id,
          registrationId: reg.id,
          studentId: reg.studentId,
          userId: reg.student.userId,
          studentCode: reg.student.studentCode,
          mssv: reg.student.studentCode,
          fullName: reg.student.user.fullName,
          hoTen: reg.student.user.fullName,
          email: reg.student.user.email,
          phone: reg.student.user.phone || 'Chưa cập nhật',
          soDienThoai: reg.student.user.phone || 'Chưa cập nhật',
          className: reg.student.className || '',
          lop: reg.student.className || '',
          department: reg.student.department?.name || '',
          khoa: reg.student.department?.name || '',
          gpa: reg.student.gpa ? Number(reg.student.gpa) : null,
          creditsEarned: reg.student.creditsEarned,
          eligible: reg.student.eligible,
          status: reg.status,
          trangThai: reg.status === 'APPROVED' ? 'DA_XAC_NHAN' : reg.status,
          trangThaiText: reg.status === 'APPROVED' ? 'Đã duyệt chính thức' : 'Chờ xác nhận',
          decisionNote: reg.decisionNote,
          decidedAt: reg.decidedAt,
          createdAt: reg.createdAt,
          ngayDangKy: reg.createdAt,
        });
      }
    }

    for (const group of topic.groups || []) {
      for (const member of group.members || []) {
        if (!seenStudentIds.has(member.studentId)) {
          seenStudentIds.add(member.studentId);
          resultList.push({
            id: `group-member-${member.studentId}`,
            registrationId: null,
            studentId: member.studentId,
            userId: member.student.userId,
            studentCode: member.student.studentCode,
            mssv: member.student.studentCode,
            fullName: member.student.user.fullName,
            hoTen: member.student.user.fullName,
            email: member.student.user.email,
            phone: member.student.user.phone || 'Chưa cập nhật',
            soDienThoai: member.student.user.phone || 'Chưa cập nhật',
            className: member.student.className || '',
            lop: member.student.className || '',
            department: member.student.department?.name || '',
            khoa: member.student.department?.name || '',
            gpa: member.student.gpa ? Number(member.student.gpa) : null,
            creditsEarned: member.student.creditsEarned,
            eligible: member.student.eligible,
            status: 'APPROVED',
            trangThai: 'DA_XAC_NHAN',
            trangThaiText: 'Đã vào nhóm đề tài',
            decisionNote: 'Thành viên nhóm KLTN',
            decidedAt: member.joinedAt,
            createdAt: member.joinedAt,
            ngayDangKy: member.joinedAt,
          });
        }
      }
    }

    return {
      topicId: topic.id,
      topicTitle: topic.title,
      capacity: topic.capacity,
      soLuongDaDangKy: resultList.length,
      soChoConLai: Math.max(0, topic.capacity - resultList.length),
      data: resultList,
      registrations: resultList,
    };
  }

  async addStudent(userId: string, topicId: string, dto: AddStudentToTopicDto) {
    // 1. Topic check & ownership
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        semester: true,
        owner: { select: { id: true, fullName: true, email: true } },
        registrations: {
          select: { studentId: true, status: true },
        },
        groups: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            members: { select: { studentId: true } },
          },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException('Không tìm thấy đề tài');
    }

    // Check ownership or management role
    const isOwner = topic.ownerId === userId;
    if (!isOwner) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const hasManagerRole = userRoles.some(
        (ur) => ur.role.code === 'TRUONG_BO_MON' || ur.role.code === 'QUAN_LY_BO_MON',
      );
      if (!hasManagerRole) {
        throw new ForbiddenException('Bạn không sở hữu đề tài này');
      }
    }

    // 2. Check: Topic đã duyệt
    if (topic.status !== 'APPROVED') {
      throw new BadRequestException('Chỉ có thể thêm sinh viên vào đề tài đã được phê duyệt');
    }

    // 3. Check: Còn chỗ
    const registeredStudentIds = new Set<string>();
    for (const reg of topic.registrations || []) {
      if (['PENDING', 'CHO_XAC_NHAN', 'APPROVED'].includes(reg.status)) {
        registeredStudentIds.add(reg.studentId);
      }
    }
    for (const group of topic.groups || []) {
      for (const member of group.members || []) {
        registeredStudentIds.add(member.studentId);
      }
    }

    if (registeredStudentIds.size >= topic.capacity) {
      throw new ConflictException('Đề tài đã đủ số lượng sinh viên tối đa, không thể thêm');
    }

    // 4. Check: Sinh viên tồn tại
    if (!dto.studentId || !dto.studentId.trim()) {
      throw new BadRequestException('Vui lòng cung cấp studentId của sinh viên');
    }
    const studentInput = dto.studentId.trim();

    const student = await this.prisma.studentProfile.findFirst({
      where: {
        OR: [
          { id: studentInput },
          { userId: studentInput },
          { studentCode: studentInput },
        ],
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        department: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Không tìm thấy thông tin sinh viên');
    }

    // 5. Check: SV đủ điều kiện
    if (!student.eligible || (student.creditsEarned ?? 0) < 110) {
      throw new BadRequestException(
        'Sinh viên chưa đủ điều kiện thực hiện Khóa luận Tốt nghiệp (cần tối thiểu 110 tín chỉ và được kích hoạt đủ điều kiện)',
      );
    }

    // 6. Check: SV chưa thuộc nhóm khác / chưa có đề tài khác trong cùng học kỳ
    if (registeredStudentIds.has(student.id)) {
      throw new ConflictException('Sinh viên đã được đăng ký vào đề tài này rồi');
    }

    const existingSemesterReg = await this.prisma.registration.findFirst({
      where: {
        studentId: student.id,
        semesterId: topic.semesterId,
        status: { in: ['PENDING', 'CHO_XAC_NHAN', 'APPROVED'] },
      },
      include: { topic: true },
    });

    const existingSemesterGroup = await this.prisma.groupMember.findFirst({
      where: {
        studentId: student.id,
        group: {
          semesterId: topic.semesterId,
          status: { not: 'CANCELLED' },
        },
      },
      include: { group: { include: { topic: true } } },
    });

    if (existingSemesterReg || existingSemesterGroup) {
      throw new ConflictException('Sinh viên đã thuộc nhóm hoặc đã đăng ký đề tài khác trong học kỳ này');
    }

    // 7. Tạo registration (status = APPROVED / DA_XAC_NHAN hoặc CHO_XAC_NHAN tùy dto)
    const statusToSet: any = dto.status === 'CHO_XAC_NHAN' ? 'CHO_XAC_NHAN' : 'APPROVED';

    // Tạo hoặc liên kết Group cho đề tài
    let activeGroup = await this.prisma.group.findFirst({
      where: {
        topicId: topic.id,
        semesterId: topic.semesterId,
        status: { not: 'CANCELLED' },
      },
      include: { members: true },
    });

    if (!activeGroup) {
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
        if (guidedGroupsCount >= maxGroups) {
          throw new ForbiddenException(
            `Giảng viên đã đạt số nhóm tối đa được phép hướng dẫn trong học kỳ này (hạn mức: ${maxGroups} nhóm)`,
          );
        }
      }

      const groupCount = await this.prisma.group.count({
        where: { semesterId: topic.semesterId },
      });
      const semCode = topic.semester?.code || 'KLTN';
      const groupCode = `GRP-${semCode}-${String(groupCount + 1).padStart(3, '0')}`;
      activeGroup = await this.prisma.group.create({
        data: {
          code: groupCode,
          name: `Nhóm ${topic.title.substring(0, 40)}`,
          topicId: topic.id,
          semesterId: topic.semesterId,
          status: 'ACTIVE',
        },
        include: { members: true },
      });
    }

    // Thêm sinh viên vào GroupMember nếu chưa có
    const alreadyMember = activeGroup.members.some((m) => m.studentId === student.id);
    if (!alreadyMember) {
      await this.prisma.groupMember.create({
        data: {
          groupId: activeGroup.id,
          studentId: student.id,
          isLeader: activeGroup.members.length === 0,
        },
      });
    }

    // Tạo bản ghi Registration
    const createdReg = await this.prisma.registration.create({
      data: {
        studentId: student.id,
        topicId: topic.id,
        semesterId: topic.semesterId,
        groupId: activeGroup.id,
        status: statusToSet,
        decisionNote: 'Giảng viên hướng dẫn trực tiếp thêm vào đề tài',
        decidedAt: statusToSet === 'APPROVED' ? new Date() : undefined,
      },
      include: {
        student: { include: { user: true } },
        topic: true,
        semester: true,
      },
    });

    // 8. Gửi Notification cho Sinh viên
    try {
      const gvName = topic.owner?.fullName || 'Giảng viên hướng dẫn';
      await this.notifications.create(
        student.userId,
        'Bạn đã được thêm vào đề tài KLTN',
        `Giảng viên ${gvName} đã thêm bạn vào đề tài "${topic.title}". Trạng thái đăng ký: Đã xác nhận (DA_XAC_NHAN).`,
        'REGISTRATION',
        {
          topicId: topic.id,
          registrationId: createdReg.id,
          groupId: activeGroup.id,
        },
        true,
      );
    } catch {
      // Don't fail the request if notification fails
    }

    return {
      id: createdReg.id,
      registrationId: createdReg.id,
      studentId: student.id,
      topicId: topic.id,
      semesterId: topic.semesterId,
      groupId: activeGroup.id,
      status: createdReg.status,
      trangThai: 'DA_XAC_NHAN',
      student: {
        id: student.id,
        studentCode: student.studentCode,
        mssv: student.studentCode,
        fullName: student.user.fullName,
        hoTen: student.user.fullName,
        email: student.user.email,
        phone: student.user.phone || 'Chưa cập nhật',
        className: student.className || '',
        lop: student.className || '',
      },
      topic: {
        id: topic.id,
        title: topic.title,
        tenDeTai: topic.title,
      },
      message: 'Thêm sinh viên vào đề tài thành công',
    };
  }
}
