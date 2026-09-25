import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateEligibilityDto } from './dto/update-eligibility.dto';
import { UpdateQuotaDto } from './dto/update-quota.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        status: true,
        roles: { include: { role: true } },
        studentProfile: {
          include: {
            department: true,
            registrations: { include: { topic: true, semester: true }, orderBy: { createdAt: 'desc' } },
          },
        },
        lecturerProfile: { include: { department: true } },
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return {
      ...user,
      roles: user.roles.map(({ role }) => role.code),
      eligible: user.studentProfile?.eligible ?? true,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fullName: dto.fullName, phone: dto.phone, avatarUrl: dto.avatarUrl },
    });
    if (dto.className !== undefined) {
      await this.prisma.studentProfile.updateMany({ where: { userId }, data: { className: dto.className } });
    }
    return this.profile(user.id);
  }

  async eligibility(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId }, include: { department: true } });
    if (!profile) return { eligible: false, reasons: ['Tài khoản chưa có hồ sơ sinh viên'] };
    const reasons: string[] = [];
    if (!profile.eligible) reasons.push('Hồ sơ chưa đủ điều kiện đăng ký KLTN');
    if (profile.creditsEarned <= 0) reasons.push('Chưa đạt số tín chỉ tối thiểu');
    return { eligible: reasons.length === 0, reasons, profile };
  }

  async lecturers() {
    return this.prisma.lecturerProfile.findMany({
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        department: true,
      },
      orderBy: { user: { fullName: 'asc' } },
    });
  }

  async students(query: { page?: number; limit?: number; search?: string; eligible?: string }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const where: any = {};
    if (query.eligible !== undefined && query.eligible !== '') {
      where.eligible = query.eligible === 'true';
    }
    if (query.search) {
      where.OR = [
        { studentCode: { contains: query.search, mode: 'insensitive' } },
        { className: { contains: query.search, mode: 'insensitive' } },
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.studentProfile.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
          department: true,
          registrations: { include: { topic: true, semester: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { studentCode: 'asc' },
      }),
      this.prisma.studentProfile.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateStudentEligibility(studentProfileId: string, dto: UpdateEligibilityDto) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { id: studentProfileId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ sinh viên');
    return this.prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: {
        eligible: dto.eligible,
        creditsEarned: dto.creditsEarned !== undefined ? dto.creditsEarned : profile.creditsEarned,
      },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async updateLecturerQuota(lecturerProfileId: string, dto: UpdateQuotaDto) {
    const lecturer = await this.prisma.lecturerProfile.findUnique({ where: { id: lecturerProfileId } });
    if (!lecturer) throw new NotFoundException('Không tìm thấy giảng viên');
    return this.prisma.lecturerProfile.update({
      where: { id: lecturerProfileId },
      data: { maxGroups: dto.maxGroups },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async getStudentProfile(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, fullName: true, phone: true, avatarUrl: true, status: true } },
        department: true,
      },
    });
    if (!student) {
      throw new NotFoundException('Không tìm thấy thông tin hồ sơ sinh viên');
    }

    const minCredits = 110;
    const isEligible = student.eligible && (student.creditsEarned ?? 0) >= minCredits;

    return {
      id: student.id,
      userId: student.userId,
      mssv: student.studentCode,
      studentCode: student.studentCode,
      hoTen: student.user.fullName,
      fullName: student.user.fullName,
      emailTruong: student.user.email,
      email: student.user.email,
      soDienThoai: student.user.phone,
      phone: student.user.phone,
      emailCaNhan: student.personalEmail,
      personalEmail: student.personalEmail,
      diaChi: student.address,
      address: student.address,
      thongTinKhac: student.contactInfo,
      contactInfo: student.contactInfo,
      lop: student.className,
      className: student.className,
      khoa: student.department?.name ?? 'Khoa Công nghệ Thông tin',
      department: student.department,
      cohort: student.cohort,
      gpa: student.gpa ? Number(student.gpa) : null,
      tinChiTichLuy: student.creditsEarned,
      creditsEarned: student.creditsEarned,
      duDieuKienDangKyKLTN: isEligible,
      eligible: student.eligible,
    };
  }

  async updateStudentProfile(
    userId: string,
    dto: UpdateStudentProfileDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: true, department: true },
    });
    if (!student) {
      throw new NotFoundException('Không tìm thấy hồ sơ sinh viên');
    }

    const phone = dto.soDienThoai !== undefined ? dto.soDienThoai : dto.phone;
    const personalEmail = dto.emailCaNhan !== undefined ? dto.emailCaNhan : dto.personalEmail;
    const address = dto.diaChi !== undefined ? dto.diaChi : dto.address;
    const contactInfo = dto.thongTinKhac !== undefined ? dto.thongTinKhac : dto.contactInfo;

    const oldValues = {
      phone: student.user.phone,
      personalEmail: student.personalEmail,
      address: student.address,
      contactInfo: student.contactInfo,
    };

    const newValues: Record<string, any> = {};
    if (phone !== undefined) newValues.phone = phone;
    if (personalEmail !== undefined) newValues.personalEmail = personalEmail;
    if (address !== undefined) newValues.address = address;
    if (contactInfo !== undefined) newValues.contactInfo = contactInfo;

    await this.prisma.$transaction([
      ...(phone !== undefined
        ? [
            this.prisma.user.update({
              where: { id: userId },
              data: { phone },
            }),
          ]
        : []),
      this.prisma.studentProfile.update({
        where: { id: student.id },
        data: {
          ...(personalEmail !== undefined ? { personalEmail } : {}),
          ...(address !== undefined ? { address } : {}),
          ...(contactInfo !== undefined ? { contactInfo } : {}),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_STUDENT_PROFILE',
          entity: 'StudentProfile',
          entityId: student.id,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          metadata: {
            old: oldValues,
            updated: newValues,
          },
        },
      }),
    ]);

    return this.getStudentProfile(userId);
  }

  async getKltnProfile(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: true, department: true },
    });
    if (!student) {
      throw new NotFoundException('Không tìm thấy hồ sơ sinh viên');
    }

    // 1. Kiểm tra nhóm KLTN của sinh viên
    const groupMember = await this.prisma.groupMember.findFirst({
      where: { studentId: student.id },
      include: {
        group: {
          include: {
            topic: {
              include: {
                owner: {
                  include: { lecturerProfile: true },
                },
              },
            },
            semester: true,
            members: {
              include: {
                student: {
                  include: { user: true },
                },
              },
              orderBy: { isLeader: 'desc' },
            },
            submissions: {
              include: {
                submitter: { select: { id: true, fullName: true, email: true } },
                report: true,
                feedbacks: {
                  include: { author: { select: { id: true, fullName: true, email: true } } },
                  orderBy: { createdAt: 'desc' },
                },
              },
              orderBy: { submittedAt: 'desc' },
            },
            chatMessages: {
              include: {
                sender: { select: { id: true, fullName: true, email: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
            defenses: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // 2. Nếu chưa có nhóm hoặc nhóm chưa gắn đề tài, kiểm tra đơn đăng ký đề tài
    let registration: any = null;
    if (!groupMember?.group?.topic) {
      registration = await this.prisma.registration.findFirst({
        where: {
          studentId: student.id,
          status: { in: ['APPROVED', 'PENDING'] },
          topicId: { not: null },
        },
        include: {
          topic: {
            include: {
              owner: {
                include: { lecturerProfile: true },
              },
            },
          },
          group: {
            include: {
              semester: true,
              members: {
                include: {
                  student: {
                    include: { user: true },
                  },
                },
                orderBy: { isLeader: 'desc' },
              },
              submissions: {
                include: {
                  submitter: { select: { id: true, fullName: true, email: true } },
                  report: true,
                  feedbacks: {
                    include: { author: { select: { id: true, fullName: true, email: true } } },
                    orderBy: { createdAt: 'desc' },
                  },
                },
                orderBy: { submittedAt: 'desc' },
              },
              chatMessages: {
                include: {
                  sender: { select: { id: true, fullName: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
              },
              defenses: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const topic = groupMember?.group?.topic || registration?.topic;
    if (!topic) {
      return {
        hasDeTai: false,
        message: 'Bạn chưa đăng ký hoặc được phân công đề tài nào',
      };
    }

    const group = groupMember?.group || registration?.group;
    const gvhdUser = topic.owner;

    // Tính toán trạng thái hiện tại (enum)
    let trangThaiHienTai = 'CHUA_DANG_KY';
    if (group) {
      if (group.defenses && group.defenses.length > 0) {
        trangThaiHienTai = group.defenses[0].status === 'COMPLETED' ? 'DA_BAO_VE' : 'DANG_BAO_VE';
      } else if (group.midtermStatus === 'STOPPED') {
        trangThaiHienTai = 'DUNG_TIEN_DO';
      } else if (group.status === 'COMPLETED') {
        trangThaiHienTai = 'HOAN_THANH';
      } else if (group.status === 'ACTIVE') {
        trangThaiHienTai = 'DANG_THUC_HIEN';
      } else {
        trangThaiHienTai = 'DANG_LAM_NHOM';
      }
    } else if (registration) {
      trangThaiHienTai = registration.status === 'APPROVED' ? 'DA_DUOC_DUYET_DE_TAI' : 'CHO_DUYET_DANG_KY';
    }

    return {
      hasDeTai: true,
      trangThaiHienTai,
      deTai: {
        id: topic.id,
        tenDeTai: topic.title,
        moTa: topic.summary || topic.objectives || '',
        mucTieu: topic.objectives || '',
        congNghe: topic.technologies || '',
        soLuongSinhVienToiDa: topic.capacity,
        trangThai: topic.status,
      },
      gvhd: {
        id: gvhdUser?.id ?? '',
        hoTen:
          (gvhdUser?.lecturerProfile?.title ? `${gvhdUser.lecturerProfile.title} ` : '') +
          (gvhdUser?.fullName || 'Chưa phân công'),
        email: gvhdUser?.email || '',
        soDienThoai: gvhdUser?.phone || 'Chưa cập nhật',
        hocHamHocVi: gvhdUser?.lecturerProfile?.title || 'Giảng viên',
        chuyenMon: gvhdUser?.lecturerProfile?.specialization || '',
      },
      nhom: group
        ? {
            id: group.id,
            maNhom: group.code,
            tenNhom: group.name,
            trangThai: group.status,
            trangThaiGiuaKy: group.midtermStatus,
          }
        : null,
      thanhVienNhom: group?.members
        ? group.members.map((m: any) => ({
            id: m.student.id,
            mssv: m.student.studentCode,
            hoTen: m.student.user.fullName,
            email: m.student.user.email,
            emailCaNhan: m.student.personalEmail,
            soDienThoai: m.student.user.phone || 'Chưa cập nhật',
            lop: m.student.className,
            vaiTro: m.isLeader ? 'Trưởng nhóm' : 'Thành viên',
            isLeader: m.isLeader,
            joinedAt: m.joinedAt,
          }))
        : [
            {
              id: student.id,
              mssv: student.studentCode,
              hoTen: student.user.fullName,
              email: student.user.email,
              emailCaNhan: student.personalEmail,
              soDienThoai: student.user.phone || 'Chưa cập nhật',
              lop: student.className,
              vaiTro: 'Trưởng nhóm',
              isLeader: true,
              joinedAt: registration?.createdAt || new Date(),
            },
          ],
      lichSuNopBai: (group?.submissions || []).map((sub: any) => ({
        id: sub.id,
        tieuDe: sub.report?.title || sub.fileName || 'Báo cáo nộp bài',
        loaiBaoCao: sub.report?.reportType || 'PROGRESS',
        tenFile: sub.fileName || '',
        fileUrl: sub.fileUrl || '',
        sourceUrl: sub.sourceUrl || '',
        ghiChu: sub.note || '',
        lanNop: sub.version || 1,
        trangThai: sub.status,
        ngayNop: sub.submittedAt,
        nguoiNop: {
          id: sub.submitter.id,
          hoTen: sub.submitter.fullName,
          email: sub.submitter.email,
        },
        phanHoi: (sub.feedbacks || []).map((fb: any) => ({
          id: fb.id,
          nguoiNhanXet: fb.author.fullName,
          emailNguoiNhanXet: fb.author.email,
          noiDung: fb.content,
          ngayTao: fb.createdAt,
        })),
      })),
      lichSuTraoDoi: (group?.chatMessages || []).map((msg: any) => ({
        id: msg.id,
        nguoiGui: msg.sender.fullName,
        emailNguoiGui: msg.sender.email,
        noiDung: msg.content,
        thoiGian: msg.createdAt,
        laGVHD: msg.sender.id === topic.ownerId,
      })),
    };
  }

  async getStudentProgress(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: true, department: true },
    });
    if (!student) {
      throw new NotFoundException('Không tìm thấy hồ sơ sinh viên');
    }

    // 1. Tìm nhóm KLTN hoặc đăng ký của sinh viên
    const groupMember = await this.prisma.groupMember.findFirst({
      where: { studentId: student.id },
      include: {
        group: {
          include: {
            topic: { include: { owner: { include: { lecturerProfile: true } } } },
            semester: true,
            reports: {
              include: {
                submissions: {
                  include: { feedbacks: true, submitter: true },
                  orderBy: { submittedAt: 'desc' },
                },
              },
            },
            submissions: {
              include: { feedbacks: true, submitter: true, report: true },
              orderBy: { submittedAt: 'desc' },
            },
            reviewerAssignments: {
              include: { lecturer: { include: { user: true } } },
            },
            defenses: {
              include: { committee: true },
            },
            scores: {
              include: { criterion: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    let registration: any = null;
    let semester: any = groupMember?.group?.semester || null;
    let topic: any = groupMember?.group?.topic || null;
    const group = groupMember?.group || null;

    if (!topic) {
      registration = await this.prisma.registration.findFirst({
        where: {
          studentId: student.id,
          status: { in: ['APPROVED', 'CHO_XAC_NHAN', 'PENDING'] },
        },
        include: {
          topic: { include: { owner: { include: { lecturerProfile: true } } } },
          semester: true,
          group: {
            include: {
              reports: { include: { submissions: true } },
              submissions: { include: { feedbacks: true, submitter: true } },
              reviewerAssignments: true,
              defenses: true,
              scores: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (registration) {
        topic = registration.topic;
        semester = registration.semester;
      }
    }

    if (!semester) {
      semester = await this.prisma.semester.findFirst({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      });
    }

    const now = new Date();

    // 2. Xác định các mốc deadline quan trọng
    const regTo = semester?.registrationTo ? new Date(semester.registrationTo) : null;
    const subTo = semester?.submissionTo ? new Date(semester.submissionTo) : null;
    const defFrom = semester?.defenseFrom ? new Date(semester.defenseFrom) : null;
    const defTo = semester?.defenseTo ? new Date(semester.defenseTo) : null;

    // Giữa kỳ deadline
    const midtermReport = group?.reports?.find((r: any) => r.reportType === 'MIDTERM');
    let midtermDue: Date | null = midtermReport?.dueAt ? new Date(midtermReport.dueAt) : null;
    if (!midtermDue && regTo && subTo) {
      const midTime = (regTo.getTime() + subTo.getTime()) / 2;
      midtermDue = new Date(midTime);
    }

    // Xác nhận giữa kỳ deadline: sau hạn nộp giữa kỳ 7 ngày
    let midtermConfirmDue: Date | null = null;
    if (midtermDue) {
      midtermConfirmDue = new Date(midtermDue.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    // Nộp cuối deadline
    const finalReport = group?.reports?.find((r: any) => r.reportType === 'FINAL');
    const finalDue: Date | null = finalReport?.dueAt ? new Date(finalReport.dueAt) : subTo;

    // Phản biện deadline
    let reviewerDue: Date | null = null;
    if (subTo && defFrom) {
      reviewerDue = new Date((subTo.getTime() + defFrom.getTime()) / 2);
    } else if (defFrom) {
      reviewerDue = new Date(defFrom.getTime() - 3 * 24 * 60 * 60 * 1000);
    }

    // Bảo vệ deadline
    const defenseSchedule = group?.defenses?.[0];
    const defenseDue: Date | null = defenseSchedule?.startsAt ? new Date(defenseSchedule.startsAt) : defTo || defFrom;

    // Kiểm tra bài nộp thực tế
    const allSubmissions = group?.submissions || [];
    const hasMidtermSubmission = allSubmissions.some(
      (s: any) => s.report?.reportType === 'MIDTERM' || s.type === 'BAO_CAO_GIUA_KY',
    );
    const hasFinalSubmission = allSubmissions.some(
      (s: any) =>
        s.report?.reportType === 'FINAL' ||
        s.report?.reportType === 'SOURCE_CODE' ||
        s.type === 'BAO_CAO_CUOI_KY' ||
        s.type === 'MA_NGUON',
    );

    const isTopicApproved =
      Boolean(group) || (registration && registration.status === 'APPROVED');

    // 3. Đánh giá trạng thái từng mốc
    // Mốc 1: Nộp giữa kỳ
    let m1Status: 'CHUA_BAT_DAU' | 'DANG_THUC_HIEN' | 'HOAN_THANH' | 'QUA_HAN' = 'CHUA_BAT_DAU';
    if (hasMidtermSubmission || group?.midtermStatus === 'CONTINUE' || group?.midtermStatus === 'STOPPED') {
      m1Status = 'HOAN_THANH';
    } else if (!isTopicApproved) {
      m1Status = 'CHUA_BAT_DAU';
    } else if (midtermDue && now > midtermDue) {
      m1Status = 'QUA_HAN';
    } else {
      m1Status = 'DANG_THUC_HIEN';
    }

    // Mốc 2: Xác nhận giữa kỳ
    let m2Status: 'CHUA_BAT_DAU' | 'DANG_THUC_HIEN' | 'HOAN_THANH' | 'QUA_HAN' = 'CHUA_BAT_DAU';
    if (group?.midtermStatus === 'CONTINUE' || group?.midtermStatus === 'STOPPED') {
      m2Status = 'HOAN_THANH';
    } else if (m1Status === 'CHUA_BAT_DAU') {
      m2Status = 'CHUA_BAT_DAU';
    } else if (midtermConfirmDue && now > midtermConfirmDue) {
      m2Status = 'QUA_HAN';
    } else if (m1Status === 'HOAN_THANH') {
      m2Status = 'DANG_THUC_HIEN';
    } else {
      m2Status = 'CHUA_BAT_DAU';
    }

    // Mốc 3: Nộp cuối (báo cáo cuối & mã nguồn)
    let m3Status: 'CHUA_BAT_DAU' | 'DANG_THUC_HIEN' | 'HOAN_THANH' | 'QUA_HAN' = 'CHUA_BAT_DAU';
    if (hasFinalSubmission) {
      m3Status = 'HOAN_THANH';
    } else if (m2Status !== 'HOAN_THANH') {
      m3Status = 'CHUA_BAT_DAU';
    } else if (finalDue && now > finalDue) {
      m3Status = 'QUA_HAN';
    } else {
      m3Status = 'DANG_THUC_HIEN';
    }

    // Mốc 4: Phản biện
    let m4Status: 'CHUA_BAT_DAU' | 'DANG_THUC_HIEN' | 'HOAN_THANH' | 'QUA_HAN' = 'CHUA_BAT_DAU';
    const hasReviewers = (group?.reviewerAssignments?.length || 0) > 0;
    const hasScores = (group?.scores?.length || 0) > 0;
    if (hasScores || (hasReviewers && (group?.defenses?.length || 0) > 0)) {
      m4Status = 'HOAN_THANH';
    } else if (m3Status !== 'HOAN_THANH') {
      m4Status = 'CHUA_BAT_DAU';
    } else if (reviewerDue && now > reviewerDue) {
      m4Status = 'QUA_HAN';
    } else if (hasReviewers) {
      m4Status = 'DANG_THUC_HIEN';
    } else {
      m4Status = 'DANG_THUC_HIEN';
    }

    // Mốc 5: Bảo vệ
    let m5Status: 'CHUA_BAT_DAU' | 'DANG_THUC_HIEN' | 'HOAN_THANH' | 'QUA_HAN' = 'CHUA_BAT_DAU';
    if (group?.defenses?.some((d: any) => d.status === 'COMPLETED')) {
      m5Status = 'HOAN_THANH';
    } else if (m4Status !== 'HOAN_THANH' && m3Status !== 'HOAN_THANH') {
      m5Status = 'CHUA_BAT_DAU';
    } else if (defenseDue && now > defenseDue) {
      m5Status = 'QUA_HAN';
    } else if (group?.defenses?.some((d: any) => d.status === 'SCHEDULED')) {
      m5Status = 'DANG_THUC_HIEN';
    } else {
      m5Status = 'CHUA_BAT_DAU';
    }

    // 4. Danh sách 5 deadline quan trọng
    const deadlines = [
      {
        id: 'nop_giua_ky',
        key: 'NOP_GIUA_KY',
        title: 'Nộp báo cáo giữa kỳ',
        description: 'Nộp tài liệu báo cáo tiến độ và kết quả đợt giữa kỳ cho GVHD',
        dueDate: midtermDue ? midtermDue.toISOString() : null,
        status: m1Status,
        isOverdue: m1Status === 'QUA_HAN',
        daysRemaining: midtermDue ? Math.ceil((midtermDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
      },
      {
        id: 'xac_nhan_giua_ky',
        key: 'XAC_NHAN_GIUA_KY',
        title: 'Xác nhận giữa kỳ',
        description: 'GVHD và bộ môn đánh giá tiếp tục hay dừng đề tài',
        dueDate: midtermConfirmDue ? midtermConfirmDue.toISOString() : null,
        status: m2Status,
        isOverdue: m2Status === 'QUA_HAN',
        daysRemaining: midtermConfirmDue ? Math.ceil((midtermConfirmDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
      },
      {
        id: 'nop_cuoi',
        key: 'NOP_CUOI_KY',
        title: 'Nộp báo cáo cuối kỳ & Mã nguồn',
        description: 'Nộp toàn bộ quyển báo cáo hoàn chỉnh, tệp mã nguồn và link demo',
        dueDate: finalDue ? finalDue.toISOString() : null,
        status: m3Status,
        isOverdue: m3Status === 'QUA_HAN',
        daysRemaining: finalDue ? Math.ceil((finalDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
      },
      {
        id: 'phan_bien',
        key: 'PHAN_BIEN',
        title: 'Đánh giá Phản biện',
        description: 'Giảng viên phản biện thẩm định quyển báo cáo và chấm điểm điều kiện',
        dueDate: reviewerDue ? reviewerDue.toISOString() : null,
        status: m4Status,
        isOverdue: m4Status === 'QUA_HAN',
        daysRemaining: reviewerDue ? Math.ceil((reviewerDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
      },
      {
        id: 'bao_ve',
        key: 'BAO_VE',
        title: 'Bảo vệ Khóa luận tốt nghiệp',
        description: 'Trình bày và bảo vệ đề tài trước Hội đồng chuyên môn',
        dueDate: defenseDue ? defenseDue.toISOString() : null,
        status: m5Status,
        isOverdue: m5Status === 'QUA_HAN',
        daysRemaining: defenseDue ? Math.ceil((defenseDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
      },
    ];

    // Checklist / Milestones
    const milestones = [
      {
        id: 'ms-0',
        order: 1,
        key: 'DANG_KY_DE_TAI',
        title: 'Đăng ký đề tài KLTN',
        description: 'Đăng ký đề tài có sẵn hoặc đề xuất đề tài riêng với GVHD',
        dueDate: regTo ? regTo.toISOString() : null,
        status: isTopicApproved ? 'HOAN_THANH' : 'DANG_THUC_HIEN',
        completedAt: registration?.decidedAt || registration?.createdAt || null,
      },
      ...deadlines.map((d, index) => ({
        id: `ms-${index + 1}`,
        order: index + 2,
        key: d.key,
        title: d.title,
        description: d.description,
        dueDate: d.dueDate,
        status: d.status,
        completedAt: d.status === 'HOAN_THANH' ? (group?.midtermAt || now.toISOString()) : null,
      })),
    ];

    // Tính percentComplete
    let percentComplete = 0;
    if (isTopicApproved) percentComplete += 10;
    if (m1Status === 'HOAN_THANH') percentComplete += 20;
    else if (m1Status === 'DANG_THUC_HIEN') percentComplete += 10;

    if (m2Status === 'HOAN_THANH') percentComplete += 20;
    else if (m2Status === 'DANG_THUC_HIEN') percentComplete += 10;

    if (m3Status === 'HOAN_THANH') percentComplete += 25;
    else if (m3Status === 'DANG_THUC_HIEN') percentComplete += 10;

    if (m4Status === 'HOAN_THANH') percentComplete += 10;
    else if (m4Status === 'DANG_THUC_HIEN') percentComplete += 5;

    if (m5Status === 'HOAN_THANH') percentComplete += 15;
    else if (m5Status === 'DANG_THUC_HIEN') percentComplete += 5;

    percentComplete = Math.min(100, Math.max(0, percentComplete));

    // Xác định giai đoạn hiện tại (currentStage)
    let currentStage = 'Chuẩn bị đăng ký đề tài';
    if (m5Status === 'HOAN_THANH') {
      currentStage = 'Đã hoàn thành Khóa luận Tốt nghiệp';
    } else if (m5Status === 'DANG_THUC_HIEN' || m5Status === 'QUA_HAN') {
      currentStage = 'Bảo vệ Khóa luận';
    } else if (m4Status === 'DANG_THUC_HIEN' || m4Status === 'QUA_HAN') {
      currentStage = 'Đánh giá Phản biện';
    } else if (m3Status === 'DANG_THUC_HIEN' || m3Status === 'QUA_HAN') {
      currentStage = 'Hoàn thiện & Nộp báo cáo cuối';
    } else if (m2Status === 'DANG_THUC_HIEN' || m2Status === 'QUA_HAN') {
      currentStage = 'Chờ xác nhận giữa kỳ';
    } else if (m1Status === 'DANG_THUC_HIEN' || m1Status === 'QUA_HAN') {
      currentStage = 'Thực hiện & Nộp báo cáo giữa kỳ';
    } else if (isTopicApproved) {
      currentStage = 'Bắt đầu nghiên cứu đề tài';
    }

    // Badge cảnh báo (alerts)
    const alerts: Array<{ type: 'danger' | 'warning' | 'info' | 'success'; message: string; deadlineKey?: string }> = [];
    for (const d of deadlines) {
      if (d.status === 'QUA_HAN') {
        alerts.push({
          type: 'danger',
          message: `Cảnh báo: Mốc "${d.title}" đã quá hạn!`,
          deadlineKey: d.key,
        });
      } else if (d.status === 'DANG_THUC_HIEN' && d.daysRemaining !== null && d.daysRemaining <= 5 && d.daysRemaining >= 0) {
        alerts.push({
          type: 'warning',
          message: `Sắp đến hạn: Mốc "${d.title}" chỉ còn ${d.daysRemaining} ngày (hạn: ${new Date(d.dueDate!).toLocaleDateString('vi-VN')}).`,
          deadlineKey: d.key,
        });
      }
    }
    if (alerts.length === 0) {
      alerts.push({
        type: 'success',
        message: 'Tiến độ KLTN của bạn đang đúng hạn.',
      });
    }

    return {
      student: {
        id: student.id,
        studentCode: student.studentCode,
        fullName: student.user.fullName,
      },
      semester: semester ? { id: semester.id, code: semester.code, name: semester.name, status: semester.status } : null,
      topic: topic ? { id: topic.id, title: topic.title } : null,
      group: group ? { id: group.id, code: group.code, name: group.name } : null,
      percentComplete,
      currentStage,
      milestones,
      deadlines,
      alerts,
    };
  }

  /**
   * Xem phân công phản biện – lịch bảo vệ – điểm chi tiết của sinh viên hiện tại
   * API: GET /students/me/defense-info
   */
  async getDefenseInfo(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: true, department: true },
    });
    if (!student) {
      throw new NotFoundException('Không tìm thấy hồ sơ sinh viên');
    }

    // 1. Tìm nhóm KLTN và đề tài của sinh viên
    const groupMember = await this.prisma.groupMember.findFirst({
      where: { studentId: student.id },
      include: {
        group: {
          include: {
            topic: {
              include: {
                owner: { select: { id: true, fullName: true, email: true, phone: true } },
                reviewer: { select: { id: true, fullName: true, email: true, phone: true } },
              },
            },
            reviewerAssignments: {
              include: {
                lecturer: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true, phone: true } },
                  },
                },
              },
            },
            defenses: {
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
              orderBy: { startsAt: 'desc' },
            },
            scores: {
              include: {
                criterion: true,
                scorer: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    let group: any = groupMember?.group || null;
    let topic: any = group?.topic || null;

    if (!group) {
      const registration = await this.prisma.registration.findFirst({
        where: {
          studentId: student.id,
          status: { in: ['APPROVED', 'CHO_XAC_NHAN', 'PENDING'] },
          topicId: { not: null },
        },
        include: {
          topic: {
            include: {
              owner: { select: { id: true, fullName: true, email: true, phone: true } },
              reviewer: { select: { id: true, fullName: true, email: true, phone: true } },
              groups: {
                include: {
                  reviewerAssignments: {
                    include: {
                      lecturer: {
                        include: {
                          user: { select: { id: true, fullName: true, email: true, phone: true } },
                        },
                      },
                    },
                  },
                  defenses: {
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
                    orderBy: { startsAt: 'desc' },
                  },
                  scores: {
                    include: {
                      criterion: true,
                      scorer: { select: { id: true, fullName: true, email: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (registration?.topic) {
        topic = registration.topic;
        if (registration.topic.groups && registration.topic.groups.length > 0) {
          group = registration.topic.groups[0];
        }
      }
    }

    if (!topic && !group) {
      return {
        danhSachGVPB: [],
        lichBaoVe: null,
        diemChiTiet: null,
        ketQuaCuoiCung: null,
        message: 'Sinh viên chưa được phân công đề tài hoặc nhóm KLTN',
      };
    }

    // 2. Danh sách Giảng viên phản biện (GVPB)
    const danhSachGVPB: Array<{
      hoTen: string;
      email: string;
      vaiTro?: string;
      soDienThoai?: string;
    }> = [];

    if (group?.reviewerAssignments) {
      for (const ra of group.reviewerAssignments) {
        if (ra.lecturer?.user) {
          danhSachGVPB.push({
            hoTen: ra.lecturer.user.fullName,
            email: ra.lecturer.user.email,
            vaiTro: ra.type === 'PRIMARY' ? 'Phản biện chính' : 'Phản biện phụ',
            soDienThoai: ra.lecturer.user.phone || undefined,
          });
        }
      }
    }

    const reviewer = topic?.reviewer;
    if (reviewer && !danhSachGVPB.some((r) => r.email === reviewer.email)) {
      danhSachGVPB.push({
        hoTen: reviewer.fullName,
        email: reviewer.email,
        vaiTro: 'Phản biện chính',
        soDienThoai: reviewer.phone || undefined,
      });
    }

    // 3. Lịch bảo vệ Khóa luận tốt nghiệp
    let lichBaoVe: {
      ngayGio: string;
      phong: string;
      hinhThuc: string;
      thanhVienHoiDong: Array<{
        hoTen: string;
        email: string;
        vaiTro: string;
      }>;
    } | null = null;

    if (group?.defenses && group.defenses.length > 0) {
      // Chỉ hiển thị khi đã được phân công chính thức (SCHEDULED hoặc COMPLETED)
      const scheduledDefense = group.defenses.find(
        (d: any) => d.status === 'SCHEDULED' || d.status === 'COMPLETED',
      );

      if (scheduledDefense) {
        const isOnline =
          scheduledDefense.room?.toLowerCase().includes('online') ||
          scheduledDefense.room?.toLowerCase().includes('meet') ||
          scheduledDefense.room?.toLowerCase().includes('zoom');

        const thanhVienHoiDong = (scheduledDefense.committee?.members || []).map((m: any) => ({
          hoTen: m.user?.fullName || '',
          email: m.user?.email || '',
          vaiTro: m.role || 'Ủy viên',
        }));

        lichBaoVe = {
          ngayGio: scheduledDefense.startsAt.toISOString(),
          phong: scheduledDefense.room || 'Chưa xếp phòng',
          hinhThuc: isOnline ? 'ONLINE' : 'TRUC_TIEP',
          thanhVienHoiDong,
        };
      }
    }

    // 4. Điểm chi tiết & Kết quả cuối cùng
    // Chỉ hiển thị khi điểm đã được công bố (status != 'DRAFT')
    const publishedScores = (group?.scores || []).filter((s: any) => s.status !== 'DRAFT');

    let diemChiTiet: {
      diemHuongDan: {
        tieuChi: Array<{
          maTieuChi: string;
          tenTieuChi: string;
          trongSo: number;
          diem: number;
          diemToiDa: number;
          ghiChu?: string | null;
        }>;
        tong: number | null;
        nguoiCham?: string | null;
      } | null;
      diemPhanBien: {
        tieuChi: Array<{
          maTieuChi: string;
          tenTieuChi: string;
          trongSo: number;
          diem: number;
          diemToiDa: number;
          ghiChu?: string | null;
        }>;
        tong: number | null;
        nguoiCham?: string | null;
      } | null;
      diemHoiDong: {
        tieuChi: Array<{
          maTieuChi: string;
          tenTieuChi: string;
          trongSo: number;
          diem: number;
          diemToiDa: number;
          ghiChu?: string | null;
        }>;
        tong: number | null;
        thanhVien?: Array<{
          hoTen: string;
          vaiTro?: string;
          tongDiem?: number;
        }>;
      } | null;
      diemTongKet: number | null;
      congThucTinh: string;
    } | null = null;

    let ketQuaCuoiCung: 'DAT' | 'KHONG_DAT' | null = null;

    if (publishedScores.length > 0) {
      const reviewerUserIds = new Set<string>();
      if (topic?.reviewerId) reviewerUserIds.add(topic.reviewerId);
      if (group?.reviewerAssignments) {
        for (const ra of group.reviewerAssignments) {
          if (ra.lecturer?.userId) reviewerUserIds.add(ra.lecturer.userId);
        }
      }

      const gvhdScores = publishedScores.filter((s: any) => s.scorerId === topic?.ownerId);
      const gvpbScores = publishedScores.filter((s: any) => reviewerUserIds.has(s.scorerId));
      const councilScores = publishedScores.filter(
        (s: any) => s.scorerId !== topic?.ownerId && !reviewerUserIds.has(s.scorerId),
      );

      // A. Điểm Hướng Dẫn
      let diemHuongDan: any = null;
      if (gvhdScores.length > 0) {
        const tieuChi = gvhdScores.map((s: any) => ({
          maTieuChi: s.criterion.code,
          tenTieuChi: s.criterion.name,
          trongSo: Number(s.criterion.weight),
          diem: Number(s.value),
          diemToiDa: Number(s.criterion.maxScore),
          ghiChu: s.note,
        }));
        const tong = Number(
          gvhdScores
            .reduce((sum: number, s: any) => sum + (Number(s.value) * Number(s.criterion.weight)) / 100, 0)
            .toFixed(2),
        );
        diemHuongDan = {
          tieuChi,
          tong,
          nguoiCham: gvhdScores[0].scorer?.fullName || topic?.owner?.fullName,
        };
      }

      // B. Điểm Phản Biện
      let diemPhanBien: any = null;
      if (gvpbScores.length > 0) {
        const tieuChi = gvpbScores.map((s: any) => ({
          maTieuChi: s.criterion.code,
          tenTieuChi: s.criterion.name,
          trongSo: Number(s.criterion.weight),
          diem: Number(s.value),
          diemToiDa: Number(s.criterion.maxScore),
          ghiChu: s.note,
        }));
        const tong = Number(
          gvpbScores
            .reduce((sum: number, s: any) => sum + (Number(s.value) * Number(s.criterion.weight)) / 100, 0)
            .toFixed(2),
        );
        diemPhanBien = {
          tieuChi,
          tong,
          nguoiCham: gvpbScores[0].scorer?.fullName || 'Giảng viên phản biện',
        };
      }

      // C. Điểm Hội Đồng
      let diemHoiDong: any = null;
      if (councilScores.length > 0) {
        const criteriaMap = new Map<string, { criterion: any; scores: number[] }>();
        for (const s of councilScores) {
          const existing = criteriaMap.get(s.criterionId) || { criterion: s.criterion, scores: [] };
          existing.scores.push(Number(s.value));
          criteriaMap.set(s.criterionId, existing);
        }

        const tieuChi = Array.from(criteriaMap.values()).map((item) => {
          const avg = item.scores.reduce((a: number, b: number) => a + b, 0) / item.scores.length;
          return {
            maTieuChi: item.criterion.code,
            tenTieuChi: item.criterion.name,
            trongSo: Number(item.criterion.weight),
            diem: Number(avg.toFixed(2)),
            diemToiDa: Number(item.criterion.maxScore),
          };
        });

        const tong = Number(
          tieuChi.reduce((sum: number, c: any) => sum + (c.diem * c.trongSo) / 100, 0).toFixed(2),
        );

        const scorerMap = new Map<string, { hoTen: string; scores: any[] }>();
        for (const s of councilScores) {
          const sc: { hoTen: string; scores: any[] } = scorerMap.get(s.scorerId) || {
            hoTen: s.scorer?.fullName || 'Ủy viên',
            scores: [] as any[],
          };
          sc.scores.push(s);
          scorerMap.set(s.scorerId, sc);
        }

        const thanhVien = Array.from(scorerMap.values()).map((sc) => ({
          hoTen: sc.hoTen,
          tongDiem: Number(
            sc.scores
              .reduce((sum: number, s: any) => sum + (Number(s.value) * Number(s.criterion.weight)) / 100, 0)
              .toFixed(2),
          ),
        }));

        diemHoiDong = {
          tieuChi,
          tong,
          thanhVien,
        };
      }

      // D. Tính Điểm Tổng Kết
      let diemTongKet: number | null = null;
      let congThucTinh = '';

      if (diemHuongDan?.tong !== undefined && diemPhanBien?.tong !== undefined && diemHoiDong?.tong !== undefined) {
        diemTongKet = Number(
          (diemHuongDan.tong * 0.3 + diemPhanBien.tong * 0.3 + diemHoiDong.tong * 0.4).toFixed(2),
        );
        congThucTinh = 'Điểm tổng kết = (Điểm GVHD × 30%) + (Điểm GVPB × 30%) + (Điểm Hội đồng × 40%)';
      } else if (diemHuongDan?.tong !== undefined && diemPhanBien?.tong !== undefined) {
        diemTongKet = Number(((diemHuongDan.tong + diemPhanBien.tong) / 2).toFixed(2));
        congThucTinh = 'Điểm tổng kết = (Điểm GVHD × 50%) + (Điểm GVPB × 50%)';
      } else if (diemHuongDan?.tong !== undefined && diemHoiDong?.tong !== undefined) {
        diemTongKet = Number(
          (diemHuongDan.tong * 0.4 + diemHoiDong.tong * 0.6).toFixed(2),
        );
        congThucTinh = 'Điểm tổng kết = (Điểm GVHD × 40%) + (Điểm Hội đồng × 60%)';
      } else if (diemHoiDong?.tong !== undefined) {
        diemTongKet = diemHoiDong.tong;
        congThucTinh = 'Điểm tổng kết = Điểm Hội đồng bảo vệ';
      } else if (diemHuongDan?.tong !== undefined) {
        diemTongKet = diemHuongDan.tong;
        congThucTinh = 'Điểm tổng kết = Điểm đánh giá GVHD';
      } else {
        // Điểm chung theo trọng số tiêu chí
        const totalWeighted = publishedScores.reduce(
          (sum: number, s: any) => sum + (Number(s.value) * Number(s.criterion.weight)) / 100,
          0,
        );
        diemTongKet = Number(totalWeighted.toFixed(2));
        congThucTinh = 'Điểm tổng kết = Tổng trọng số các tiêu chí đánh giá KLTN';
      }

      // Cộng điểm NCKH (nếu có minh chứng được duyệt)
      const approvedEvidence = await this.prisma.evidence.findMany({
        where: { userId, status: 'APPROVED' },
      });
      const bonusPoints = approvedEvidence.reduce(
        (sum: number, ev: any) => sum + (ev.points ? Number(ev.points) : 0),
        0,
      );
      if (bonusPoints > 0 && diemTongKet !== null) {
        diemTongKet = Math.min(10, Number((diemTongKet + bonusPoints).toFixed(2)));
        congThucTinh += ` + Điểm thưởng NCKH (+${bonusPoints}đ, tối đa 10đ)`;
      }

      if (diemTongKet !== null) {
        ketQuaCuoiCung = diemTongKet >= 5.0 ? 'DAT' : 'KHONG_DAT';
      }

      diemChiTiet = {
        diemHuongDan,
        diemPhanBien,
        diemHoiDong,
        diemTongKet,
        congThucTinh,
      };
    }

    return {
      danhSachGVPB,
      lichBaoVe,
      diemChiTiet,
      ketQuaCuoiCung,
    };
  }

  async getLecturerDashboard(userId: string) {
    const lecturerProfile = await this.prisma.lecturerProfile.findUnique({
      where: { userId },
      include: { department: true },
    });

    const maxGroupsQuota = lecturerProfile?.maxGroups ?? 5;

    // Lấy tất cả nhóm mà giảng viên này hướng dẫn
    const groups = await this.prisma.group.findMany({
      where: {
        topic: { ownerId: userId },
      },
      include: {
        topic: true,
        members: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
              },
            },
          },
        },
        submissions: {
          include: {
            feedbacks: true,
          },
          orderBy: { submittedAt: 'desc' },
        },
        scores: {
          where: { scorerId: userId },
        },
      },
      orderBy: { code: 'asc' },
    });

    const soNhomHuongDan = groups.length;

    // Thống kê số lần nộp
    let tongSoLanNop = 0;
    let soLanDaDuyet = 0;
    let soLanCanChinhSua = 0;
    let soLanDangXem = 0;
    let soLanDaTuChoi = 0;

    // Thống kê trạng thái giữa kỳ
    let choLamTiepCount = 0;
    let dungDeTaiCount = 0;
    let chuaDanhGiaCount = 0;

    // Danh sách cảnh báo chậm tiến độ
    const canhBaoChamTienDo: {
      groupId: string;
      groupCode: string;
      topicTitle: string;
      reason: string;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
    }[] = [];

    const now = new Date();
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

    const danhSachNhom = groups.map((group) => {
      // Thống kê bài nộp của nhóm
      const groupSubmissions = group.submissions || [];
      tongSoLanNop += groupSubmissions.length;

      for (const sub of groupSubmissions) {
        if (sub.status === 'ACCEPTED') soLanDaDuyet++;
        else if (sub.status === 'REVISION_REQUIRED') soLanCanChinhSua++;
        else if (sub.status === 'REJECTED') soLanDaTuChoi++;
        else soLanDangXem++;
      }

      // Trạng thái giữa kỳ
      if (group.midtermStatus === 'CONTINUE') {
        choLamTiepCount++;
      } else if (group.midtermStatus === 'STOPPED') {
        dungDeTaiCount++;
      } else {
        chuaDanhGiaCount++;
      }

      // Tính % tiến độ cho nhóm
      let progressPct = 20; // Khởi tạo: đề tài đã được duyệt / phân công nhóm

      if (groupSubmissions.length === 1) {
        progressPct += 15;
      } else if (groupSubmissions.length >= 2) {
        progressPct += 25;
      }
      if (groupSubmissions.some((s) => s.status === 'ACCEPTED')) {
        progressPct += 10;
      }

      if (group.midtermStatus === 'CONTINUE') {
        progressPct += 25;
      }

      if (group.scores.length > 0) {
        const isLocked = group.scores.some((s) => s.status === 'LOCKED');
        progressPct += isLocked ? 20 : 10;
      }

      progressPct = Math.min(100, progressPct);

      // Cảnh báo chậm tiến độ
      if (groupSubmissions.length === 0) {
        canhBaoChamTienDo.push({
          groupId: group.id,
          groupCode: group.code,
          topicTitle: group.topic?.title || 'Chưa đặt tên',
          reason: 'Chưa có bất kỳ bài nộp báo cáo tiến độ nào',
          severity: 'HIGH',
        });
      } else {
        const latestSub = groupSubmissions[0];
        const lastSubTime = new Date(latestSub.submittedAt).getTime();
        if (now.getTime() - lastSubTime > FOURTEEN_DAYS_MS && group.midtermStatus !== 'STOPPED' && progressPct < 100) {
          canhBaoChamTienDo.push({
            groupId: group.id,
            groupCode: group.code,
            topicTitle: group.topic?.title || 'Chưa đặt tên',
            reason: 'Đã hơn 14 ngày không có bài nộp báo cáo mới',
            severity: 'HIGH',
          });
        }

        if (latestSub.status === 'REVISION_REQUIRED') {
          canhBaoChamTienDo.push({
            groupId: group.id,
            groupCode: group.code,
            topicTitle: group.topic?.title || 'Chưa đặt tên',
            reason: `Bài nộp gần nhất ("${latestSub.fileName || 'Báo cáo'}") bị yêu cầu chỉnh sửa lại`,
            severity: 'MEDIUM',
          });
        }
      }

      if (group.midtermStatus === 'STOPPED') {
        canhBaoChamTienDo.push({
          groupId: group.id,
          groupCode: group.code,
          topicTitle: group.topic?.title || 'Chưa đặt tên',
          reason: 'Nhóm đã bị dừng đề tài ở đợt đánh giá giữa kỳ',
          severity: 'HIGH',
        });
      }

      return {
        id: group.id,
        code: group.code,
        name: group.name,
        topic: group.topic
          ? {
              id: group.topic.id,
              title: group.topic.title,
              technologies: group.topic.technologies,
            }
          : null,
        members: group.members.map((m) => ({
          id: m.student.id,
          studentCode: m.student.studentCode,
          fullName: m.student.user?.fullName,
          email: m.student.user?.email,
          phone: m.student.user?.phone,
          isLeader: m.isLeader,
        })),
        tienDo: progressPct,
        soBaiNop: groupSubmissions.length,
        lanNopCuoi:
          groupSubmissions.length > 0
            ? {
                id: groupSubmissions[0].id,
                fileName: groupSubmissions[0].fileName,
                submittedAt: groupSubmissions[0].submittedAt,
                status: groupSubmissions[0].status,
              }
            : null,
        midtermStatus: group.midtermStatus,
        hasScored: group.scores.length > 0,
      };
    });

    const phanTramHoanThanhTrungBinh =
      soNhomHuongDan > 0
        ? Math.round((danhSachNhom.reduce((sum, g) => sum + g.tienDo, 0) / soNhomHuongDan) * 10) / 10
        : 0;

    return {
      soNhomHuongDan,
      maxGroupsQuota,
      choTrong: Math.max(0, maxGroupsQuota - soNhomHuongDan),
      phanTramHoanThanhTrungBinh,
      soLanNop: {
        tong: tongSoLanNop,
        daDuyet: soLanDaDuyet,
        canChinhSua: soLanCanChinhSua,
        dangXem: soLanDangXem,
        daTuChoi: soLanDaTuChoi,
      },
      canhBaoChamTienDo,
      trangThaiGiuaKy: {
        choLamTiep: choLamTiepCount,
        dungDeTai: dungDeTaiCount,
        chuaDanhGia: chuaDanhGiaCount,
      },
      danhSachNhom,
    };
  }

  async getLecturerReviewAssignments(userId: string) {
    const lecturerProfile = await this.prisma.lecturerProfile.findUnique({
      where: { userId },
    });

    const orConditions: any[] = [];
    if (lecturerProfile) {
      orConditions.push({
        reviewerAssignments: {
          some: { lecturerId: lecturerProfile.id },
        },
      });
    }
    orConditions.push({
      topic: { reviewerId: userId },
    });

    const groups = await this.prisma.group.findMany({
      where: {
        OR: orConditions,
      },
      include: {
        topic: {
          include: {
            owner: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
          },
        },
        members: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
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
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
        defenses: {
          include: {
            committee: true,
          },
          orderBy: { startsAt: 'asc' },
        },
        scores: {
          where: { scorerId: userId },
          include: { criterion: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return groups.map((group) => {
      const myReviewAssignment = group.reviewerAssignments.find(
        (ra) =>
          ra.lecturer?.user?.id === userId ||
          (lecturerProfile && ra.lecturerId === lecturerProfile.id),
      );

      const latestSub = group.submissions && group.submissions.length > 0 ? group.submissions[0] : null;
      const latestDefense = group.defenses && group.defenses.length > 0 ? group.defenses[0] : null;

      const scoredList = group.scores || [];
      const hasScored = scoredList.length > 0;
      const isLocked = scoredList.some((s) => s.status === 'LOCKED');

      let weightedTotal: number | null = null;
      if (hasScored) {
        const total = scoredList.reduce(
          (sum, s) => sum + (Number(s.value) * Number(s.criterion.weight)) / 100,
          0,
        );
        weightedTotal = Math.round(total * 100) / 100;
      }

      return {
        id: group.id,
        groupId: group.id,
        groupCode: group.code,
        groupName: group.name,
        type: myReviewAssignment?.type ?? 'PRIMARY',
        assignedAt: myReviewAssignment?.assignedAt ?? group.topic?.createdAt ?? new Date(),
        topic: group.topic
          ? {
              id: group.topic.id,
              title: group.topic.title,
              summary: group.topic.summary,
              technologies: group.topic.technologies,
            }
          : null,
        supervisor: group.topic?.owner
          ? {
              id: group.topic.owner.id,
              fullName: group.topic.owner.fullName,
              email: group.topic.owner.email,
              phone: group.topic.owner.phone,
            }
          : null,
        members: group.members.map((m) => ({
          id: m.student.id,
          studentCode: m.student.studentCode,
          fullName: m.student.user?.fullName,
          email: m.student.user?.email,
          phone: m.student.user?.phone,
          isLeader: m.isLeader,
        })),
        latestSubmission: latestSub
          ? {
              id: latestSub.id,
              fileName: latestSub.fileName,
              fileUrl: latestSub.fileUrl,
              fileSize: latestSub.fileSize,
              submittedAt: latestSub.submittedAt,
              status: latestSub.status,
            }
          : null,
        defenseSchedule: latestDefense
          ? {
              id: latestDefense.id,
              startsAt: latestDefense.startsAt,
              endsAt: latestDefense.endsAt,
              room: latestDefense.room,
              status: latestDefense.status,
              committeeName: latestDefense.committee?.name,
            }
          : null,
        scoring: {
          hasScored,
          isLocked,
          totalScore: weightedTotal,
          scoresCount: scoredList.length,
        },
      };
    });
  }

  async getLecturerCommitteeAssignments(userId: string) {
    const committeeMemberships = await this.prisma.defenseCommitteeMember.findMany({
      where: { userId },
      include: {
        committee: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, phone: true },
                },
              },
            },
            schedules: {
              include: {
                group: {
                  include: {
                    topic: {
                      include: {
                        owner: {
                          select: { id: true, fullName: true, email: true, phone: true },
                        },
                      },
                    },
                    members: {
                      include: {
                        student: {
                          include: {
                            user: {
                              select: { id: true, fullName: true, email: true, phone: true },
                            },
                          },
                        },
                      },
                    },
                    scores: {
                      where: { scorerId: userId },
                    },
                    submissions: {
                      orderBy: { submittedAt: 'desc' },
                      take: 1,
                    },
                  },
                },
              },
              orderBy: { startsAt: 'asc' },
            },
          },
        },
      },
    });

    return committeeMemberships.map((membership) => {
      const committee = membership.committee;

      // STRICT FILTER: Loại bỏ các ca bảo vệ của nhóm do chính giảng viên này hướng dẫn (chống xung đột lợi ích)
      const allSchedules = committee.schedules || [];
      const nonGuidedSchedules = allSchedules.filter((sched) => {
        const topicOwnerId = sched.group?.topic?.ownerId;
        return topicOwnerId !== userId;
      });

      const excludedGuidedGroupsCount = allSchedules.length - nonGuidedSchedules.length;

      const schedulesMapped = nonGuidedSchedules.map((sched) => {
        const group = sched.group;
        const latestSub =
          group?.submissions && group.submissions.length > 0 ? group.submissions[0] : null;
        const hasScored = (group?.scores?.length || 0) > 0;
        const isLocked = group?.scores?.some((s) => s.status === 'LOCKED') || false;

        return {
          id: sched.id,
          startsAt: sched.startsAt,
          endsAt: sched.endsAt,
          room: sched.room,
          status: sched.status,
          group: group
            ? {
                id: group.id,
                code: group.code,
                name: group.name,
                topic: group.topic
                  ? {
                      id: group.topic.id,
                      title: group.topic.title,
                      summary: group.topic.summary,
                      technologies: group.topic.technologies,
                    }
                  : null,
                supervisor: group.topic?.owner
                  ? {
                      id: group.topic.owner.id,
                      fullName: group.topic.owner.fullName,
                      email: group.topic.owner.email,
                      phone: group.topic.owner.phone,
                    }
                  : null,
                members: group.members.map((m) => ({
                  id: m.student.id,
                  studentCode: m.student.studentCode,
                  fullName: m.student.user?.fullName,
                  email: m.student.user?.email,
                  phone: m.student.user?.phone,
                  isLeader: m.isLeader,
                })),
                latestSubmission: latestSub
                  ? {
                      id: latestSub.id,
                      fileName: latestSub.fileName,
                      fileUrl: latestSub.fileUrl,
                      submittedAt: latestSub.submittedAt,
                      status: latestSub.status,
                    }
                  : null,
                hasScored,
                isLocked,
              }
            : null,
        };
      });

      return {
        committeeId: committee.id,
        committeeName: committee.name,
        myRole: membership.role,
        members: committee.members.map((m) => ({
          userId: m.userId,
          fullName: m.user.fullName,
          email: m.user.email,
          phone: m.user.phone,
          role: m.role,
        })),
        schedules: schedulesMapped,
        totalSchedules: allSchedules.length,
        evaluableSchedulesCount: nonGuidedSchedules.length,
        excludedGuidedGroupsCount,
        antiConflictProtected: excludedGuidedGroupsCount > 0,
      };
    });
  }

  async getAvailableReviewers(groupId: string) {
    if (!groupId) {
      throw new BadRequestException('groupId là bắt buộc');
    }

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
                lecturerProfile: { select: { id: true, lecturerCode: true, title: true } },
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
      },
    });

    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm KLTN');
    }

    const advisorUserId = group.topic?.ownerId;
    const advisorLecturerProfileId = group.topic?.owner?.lecturerProfile?.id;

    // Load max review group config if set
    const maxReviewConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'MAX_REVIEW_GROUPS', semesterId: group.semesterId },
    });
    const defaultMaxReview = typeof maxReviewConfig?.value === 'number' ? maxReviewConfig.value : 5;

    // Load all active lecturers
    const lecturers = await this.prisma.lecturerProfile.findMany({
      where: {
        user: { status: 'ACTIVE' },
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        quotas: {
          where: { semesterId: group.semesterId },
        },
      },
      orderBy: [{ user: { fullName: 'asc' } }],
    });

    // Count current reviewer assignments for each lecturer in this semester
    const reviewCounts = await this.prisma.reviewerAssignment.groupBy({
      by: ['lecturerId'],
      where: {
        group: {
          semesterId: group.semesterId,
          status: { not: 'CANCELLED' },
        },
      },
      _count: { id: true },
    });
    const reviewCountMap = new Map<string, number>();
    for (const rc of reviewCounts) {
      reviewCountMap.set(rc.lecturerId, rc._count.id);
    }

    const allReviewers = lecturers.map((l) => {
      const isAdvisor =
        (advisorUserId && l.userId === advisorUserId) ||
        (advisorLecturerProfileId && l.id === advisorLecturerProfileId);
      const currentReviewCount = reviewCountMap.get(l.id) ?? 0;
      const maxReviews = l.quotas[0]?.maxGroups ?? defaultMaxReview;
      const remainingSlots = Math.max(0, maxReviews - currentReviewCount);
      const isOverloaded = remainingSlots <= 0;
      const isAlreadyAssigned = group.reviewerAssignments.some((ra) => ra.lecturerId === l.id);

      let isAvailable = true;
      let reason: string | null = null;

      if (isAdvisor) {
        isAvailable = false;
        reason = 'Là giảng viên hướng dẫn (GVHD) của nhóm này (loại trừ theo quy định)';
      } else if (isOverloaded) {
        isAvailable = false;
        reason = `Đã đạt định mức phản biện tối đa (${currentReviewCount}/${maxReviews} nhóm)`;
      }

      return {
        id: l.id,
        lecturerId: l.id,
        userId: l.userId,
        lecturerCode: l.lecturerCode,
        fullName: l.user?.fullName || '',
        email: l.user?.email || '',
        phone: l.user?.phone || '',
        title: l.title || 'Giảng viên',
        specialization: l.specialization || '',
        department: l.department,
        departmentName: l.department?.name || '',
        currentReviewCount,
        maxReviews,
        remainingSlots,
        isAdvisor,
        isOverloaded,
        isAlreadyAssigned,
        isAvailable,
        reason,
      };
    });

    const availableReviewers = allReviewers.filter((r) => r.isAvailable);

    // Retrieve configured reviewer pairs or generate suggested pairs
    const pairsConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'REVIEWER_PAIRS', semesterId: group.semesterId },
    });
    const configuredPairsRaw = Array.isArray(pairsConfig?.value) ? (pairsConfig.value as any[]) : [];

    const suggestedPairs: any[] = [];

    // Process configured pairs if any
    for (const cp of configuredPairsRaw) {
      const rev1 = availableReviewers.find((r) => r.id === cp.lecturerId1 || r.userId === cp.lecturerId1);
      const rev2 = availableReviewers.find((r) => r.id === cp.lecturerId2 || r.userId === cp.lecturerId2);
      if (rev1 && rev2) {
        suggestedPairs.push({
          pairId: cp.id || `configured_${rev1.id}_${rev2.id}`,
          name: cp.name || `Cặp: ${rev1.fullName} & ${rev2.fullName}`,
          reviewer1: rev1,
          reviewer2: rev2,
          reviewerIds: [rev1.id, rev2.id],
          isAvailable: true,
          remainingSlots: Math.min(rev1.remainingSlots, rev2.remainingSlots),
          source: 'CONFIGURED',
        });
      }
    }

    // If no configured pairs or to supplement, auto-pair available lecturers
    if (suggestedPairs.length === 0) {
      for (let i = 0; i < availableReviewers.length - 1; i += 2) {
        const rev1 = availableReviewers[i];
        const rev2 = availableReviewers[i + 1];
        suggestedPairs.push({
          pairId: `auto_${rev1.id}_${rev2.id}`,
          name: `Cặp ${Math.floor(i / 2) + 1}: ${rev1.fullName} & ${rev2.fullName}`,
          reviewer1: rev1,
          reviewer2: rev2,
          reviewerIds: [rev1.id, rev2.id],
          isAvailable: true,
          remainingSlots: Math.min(rev1.remainingSlots, rev2.remainingSlots),
          source: 'AUTO_SUGGESTED',
        });
      }
    }

    const hasEnoughReviewers = availableReviewers.length >= 2;
    const message = hasEnoughReviewers
      ? 'Lấy danh sách giảng viên phản biện khả dụng thành công'
      : 'Không đủ số lượng giảng viên phù hợp để phân công 2 GVPB (cần tối thiểu 2 giảng viên không phải GVHD và chưa đủ định mức)';

    return {
      groupId: group.id,
      groupCode: group.code,
      groupName: group.name,
      topicTitle: group.topic?.title,
      midtermStatus: group.midtermStatus,
      isReadyForReview: group.midtermStatus === 'CONTINUE',
      gvhd: group.topic?.owner
        ? {
            id: group.topic.owner.id,
            fullName: group.topic.owner.fullName,
            email: group.topic.owner.email,
            lecturerProfileId: group.topic.owner.lecturerProfile?.id,
          }
        : null,
      currentAssignments: group.reviewerAssignments.map((ra) => ({
        id: ra.id,
        lecturerId: ra.lecturerId,
        fullName: ra.lecturer.user?.fullName,
        type: ra.type,
      })),
      hasEnoughReviewers,
      message,
      availableReviewers,
      allReviewers,
      suggestedPairs,
    };
  }

  async getReviewerPairs(semesterId?: string) {
    const semester = semesterId
      ? await this.prisma.semester.findUnique({ where: { id: semesterId } })
      : (await this.prisma.semester.findFirst({
          where: { status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
        })) ??
        (await this.prisma.semester.findFirst({
          orderBy: { createdAt: 'desc' },
        }));

    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    const pairsConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'REVIEWER_PAIRS', semesterId: semester.id },
    });
    const pairs = Array.isArray(pairsConfig?.value) ? pairsConfig.value : [];
    return {
      semesterId: semester.id,
      pairs,
    };
  }

  async saveReviewerPairs(semesterId: string, pairs: any[]) {
    const existing = await this.prisma.systemConfig.findFirst({
      where: { key: 'REVIEWER_PAIRS', semesterId },
    });

    if (existing) {
      return this.prisma.systemConfig.update({
        where: { id: existing.id },
        data: { value: pairs },
      });
    }

    return this.prisma.systemConfig.create({
      data: {
        key: 'REVIEWER_PAIRS',
        value: pairs,
        description: 'Cấu hình các cặp Giảng viên phản biện',
        semesterId,
      },
    });
  }
}

