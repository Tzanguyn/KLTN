import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper xác định đợt KLTN mục tiêu:
   * Nếu có semesterId: dùng semesterId đó.
   * Nếu không: lấy đợt OPEN gần nhất hoặc đợt mới nhất trong DB.
   */
  async resolveSemester(semesterId?: string) {
    if (semesterId) {
      const semester = await this.prisma.semester.findUnique({
        where: { id: semesterId },
        include: { department: true },
      });
      if (!semester) throw new NotFoundException('Không tìm thấy đợt KLTN yêu cầu');
      return semester;
    }

    const activeSemester = await this.prisma.semester.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    if (activeSemester) return activeSemester;

    const latest = await this.prisma.semester.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    if (!latest) throw new NotFoundException('Chưa có đợt KLTN nào trong hệ thống');
    return latest;
  }

  /**
   * 1. GET /statistics/registration-status?semesterId=
   * Thống kê tình hình đăng ký KLTN, số lượng SV đã đăng ký / chưa đăng ký,
   * danh sách nhóm FORMING/ACTIVE/CANCELLED và danh sách SV chưa đăng ký.
   */
  async getRegistrationStatus(semesterId?: string) {
    const semester = await this.resolveSemester(semesterId);

    // Danh sách sinh viên đủ điều kiện
    const eligibleStudents = await this.prisma.studentProfile.findMany({
      where: {
        eligible: true,
        ...(semester.departmentId ? { departmentId: semester.departmentId } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        department: { select: { id: true, code: true, name: true } },
      },
      orderBy: { studentCode: 'asc' },
    });

    // Danh sách đơn đăng ký
    const registrations = await this.prisma.registration.findMany({
      where: { semesterId: semester.id },
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
                lecturerProfile: { select: { lecturerCode: true, title: true } },
              },
            },
          },
        },
        group: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Danh sách nhóm
    const groups = await this.prisma.group.findMany({
      where: { semesterId: semester.id },
      include: {
        topic: {
          include: {
            owner: { select: { id: true, fullName: true, email: true, phone: true } },
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
          orderBy: { isLeader: 'desc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    // Danh sách đề tài đã duyệt
    const topics = await this.prisma.topic.findMany({
      where: { semesterId: semester.id, status: 'APPROVED' },
      select: { id: true, title: true, capacity: true },
    });
    const totalCapacity = topics.reduce((sum, t) => sum + (t.capacity || 2), 0);

    // Tập hợp ID sinh viên đã có đăng ký hoặc đã có nhóm (active)
    const registeredStudentIds = new Set<string>();
    registrations.forEach((r) => {
      if (['CHO_XAC_NHAN', 'PENDING', 'APPROVED'].includes(r.status)) {
        registeredStudentIds.add(r.studentId);
      }
    });
    groups.forEach((g) => {
      if (g.status !== 'CANCELLED') {
        g.members.forEach((m) => registeredStudentIds.add(m.studentId));
      }
    });

    // Sinh viên chưa đăng ký
    const unregisteredStudents = eligibleStudents.filter((s) => !registeredStudentIds.has(s.id));

    // Phân loại nhóm theo trạng thái
    const groupsByStatus = {
      FORMING: groups.filter((g) => g.status === 'FORMING'),
      ACTIVE: groups.filter((g) => g.status === 'ACTIVE'),
      COMPLETED: groups.filter((g) => g.status === 'COMPLETED'),
      CANCELLED: groups.filter((g) => g.status === 'CANCELLED'),
    };

    // Phân loại đơn đăng ký theo trạng thái
    const registrationsByStatus = {
      APPROVED: registrations.filter((r) => r.status === 'APPROVED'),
      CHO_XAC_NHAN: registrations.filter(
        (r) => r.status === 'CHO_XAC_NHAN' || r.status === 'PENDING',
      ),
      REJECTED: registrations.filter((r) => r.status === 'REJECTED'),
      DA_HUY: registrations.filter(
        (r) => r.status === 'DA_HUY' || r.status === 'CANCELLED' || r.status === 'WITHDRAWN',
      ),
    };

    // Số chỗ đã đăng ký
    const occupiedSlots = registrations.filter((r) => r.status === 'APPROVED').length;

    return {
      semester: {
        id: semester.id,
        code: semester.code,
        name: semester.name,
        status: semester.status,
        academicYear: semester.academicYear,
        registrationFrom: semester.registrationFrom,
        registrationTo: semester.registrationTo,
      },
      summary: {
        totalEligibleStudents: eligibleStudents.length,
        registeredStudents: registeredStudentIds.size,
        unregisteredStudents: unregisteredStudents.length,
        registrationRate:
          eligibleStudents.length > 0
            ? Math.round((registeredStudentIds.size / eligibleStudents.length) * 100)
            : 0,
        totalTopics: topics.length,
        totalCapacity,
        occupiedSlots,
        remainingSlots: Math.max(0, totalCapacity - occupiedSlots),
        totalRegistrations: registrations.length,
        approvedRegistrations: registrationsByStatus.APPROVED.length,
        pendingRegistrations: registrationsByStatus.CHO_XAC_NHAN.length,
        rejectedRegistrations: registrationsByStatus.REJECTED.length,
        cancelledRegistrations: registrationsByStatus.DA_HUY.length,
        totalGroups: groups.length,
        formingGroups: groupsByStatus.FORMING.length,
        activeGroups: groupsByStatus.ACTIVE.length,
        completedGroups: groupsByStatus.COMPLETED.length,
        cancelledGroups: groupsByStatus.CANCELLED.length,
      },
      groups: groupsByStatus,
      registrations: registrationsByStatus,
      unregisteredStudents: unregisteredStudents.map((s) => ({
        id: s.id,
        studentCode: s.studentCode,
        fullName: s.user.fullName,
        email: s.user.email,
        phone: s.user.phone,
        className: s.className,
        department: s.department?.name,
        gpa: s.gpa ? Number(s.gpa) : null,
        creditsEarned: s.creditsEarned,
      })),
    };
  }

  /**
   * 2. GET /statistics/progress?semesterId=
   * Thống kê tiến độ thực hiện KLTN tổng thể, phân loại nhóm thành 4 trạng thái:
   * HOAN_THANH, DANG_THUC_HIEN, QUA_HAN, DUNG kèm % tiến độ chi tiết.
   */
  async getProgress(semesterId?: string) {
    const semester = await this.resolveSemester(semesterId);

    const groups = await this.prisma.group.findMany({
      where: { semesterId: semester.id },
      include: {
        topic: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                lecturerProfile: { select: { lecturerCode: true, title: true } },
              },
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
          orderBy: { isLeader: 'desc' },
        },
        reports: {
          include: {
            submissions: {
              orderBy: { submittedAt: 'desc' },
            },
          },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          include: { report: true, submitter: { select: { fullName: true } } },
        },
        reviewerAssignments: {
          include: { lecturer: { include: { user: true } } },
        },
        defenses: {
          include: { committee: true },
        },
        scores: true,
      },
      orderBy: { code: 'asc' },
    });

    const now = new Date();
    const regTo = semester.registrationTo ? new Date(semester.registrationTo) : null;
    const subTo = semester.submissionTo ? new Date(semester.submissionTo) : null;
    const defFrom = semester.defenseFrom ? new Date(semester.defenseFrom) : null;
    const defTo = semester.defenseTo ? new Date(semester.defenseTo) : null;

    // Giữa kỳ deadline
    let defaultMidtermDue: Date | null = null;
    if (regTo && subTo) {
      defaultMidtermDue = new Date((regTo.getTime() + subTo.getTime()) / 2);
    }
    const defaultMidtermConfirmDue = defaultMidtermDue
      ? new Date(defaultMidtermDue.getTime() + 7 * 86400000)
      : null;
    const defaultFinalDue = subTo;
    const defaultReviewDue = subTo && defFrom
      ? new Date((subTo.getTime() + defFrom.getTime()) / 2)
      : defFrom
      ? new Date(defFrom.getTime() - 3 * 86400000)
      : null;
    const defaultDefenseDue = defTo || defFrom;

    const analyzedGroups = groups.map((g) => {
      const allSubs = g.submissions || [];
      const hasMidtermSub = allSubs.some(
        (s) => s.report?.reportType === 'MIDTERM' || (s as any).type === 'BAO_CAO_GIUA_KY',
      );
      const hasMidtermEval = g.midtermStatus === 'CONTINUE' || g.midtermStatus === 'STOPPED';
      const hasFinalSub = allSubs.some(
        (s) =>
          s.report?.reportType === 'FINAL' ||
          s.report?.reportType === 'SOURCE_CODE' ||
          (s as any).type === 'BAO_CAO_CUOI_KY' ||
          (s as any).type === 'MA_NGUON',
      );
      const hasReview = g.scores.length > 0 || g.reviewerAssignments.length > 0;
      const hasDefense = g.defenses.some((d) => d.status === 'COMPLETED');

      // Tính % tiến độ (mỗi mốc 20%)
      let progressPercent = 0;
      if (hasMidtermSub) progressPercent += 20;
      if (hasMidtermEval) progressPercent += 20;
      if (hasFinalSub) progressPercent += 20;
      if (hasReview) progressPercent += 20;
      if (hasDefense) progressPercent += 20;

      // Nhận diện mốc quá hạn
      const overdueMilestones: string[] = [];

      // Mốc 1: Nộp giữa kỳ
      const mReport = g.reports.find((r) => r.reportType === 'MIDTERM');
      const midtermDue = mReport?.dueAt ? new Date(mReport.dueAt) : defaultMidtermDue;
      if (!hasMidtermSub && midtermDue && now > midtermDue && g.status !== 'CANCELLED') {
        overdueMilestones.push('Nộp báo cáo giữa kỳ');
      }

      // Mốc 2: Xác nhận giữa kỳ
      if (
        !hasMidtermEval &&
        defaultMidtermConfirmDue &&
        now > defaultMidtermConfirmDue &&
        g.status !== 'CANCELLED'
      ) {
        overdueMilestones.push('Đánh giá giữa kỳ');
      }

      // Mốc 3: Nộp cuối
      const fReport = g.reports.find((r) => r.reportType === 'FINAL');
      const finalDue = fReport?.dueAt ? new Date(fReport.dueAt) : defaultFinalDue;
      if (!hasFinalSub && finalDue && now > finalDue && g.status !== 'CANCELLED') {
        overdueMilestones.push('Nộp báo cáo cuối kỳ & mã nguồn');
      }

      // Mốc 4: Phản biện
      if (!hasReview && defaultReviewDue && now > defaultReviewDue && g.status !== 'CANCELLED') {
        overdueMilestones.push('Chấm phản biện');
      }

      // Mốc 5: Bảo vệ
      const defSchedule = g.defenses[0];
      const defenseDue = defSchedule?.startsAt ? new Date(defSchedule.startsAt) : defaultDefenseDue;
      if (!hasDefense && defenseDue && now > defenseDue && g.status !== 'CANCELLED') {
        overdueMilestones.push('Bảo vệ khóa luận');
      }

      // Phân loại tổng thể
      let progressCategory: 'HOAN_THANH' | 'DANG_THUC_HIEN' | 'QUA_HAN' | 'DUNG';
      if (g.status === 'CANCELLED' || g.midtermStatus === 'STOPPED') {
        progressCategory = 'DUNG';
      } else if (g.status === 'COMPLETED' || hasDefense || progressPercent === 100) {
        progressCategory = 'HOAN_THANH';
        progressPercent = 100;
      } else if (overdueMilestones.length > 0) {
        progressCategory = 'QUA_HAN';
      } else {
        progressCategory = 'DANG_THUC_HIEN';
      }

      return {
        id: g.id,
        code: g.code,
        name: g.name,
        status: g.status,
        midtermStatus: g.midtermStatus,
        midtermNote: g.midtermNote,
        progressCategory,
        progressPercent,
        overdueMilestones,
        isOverdue: overdueMilestones.length > 0,
        memberCount: g.members.length,
        topic: g.topic
          ? {
              id: g.topic.id,
              title: g.topic.title,
              owner: g.topic.owner,
            }
          : null,
        members: g.members.map((m) => ({
          studentId: m.studentId,
          studentCode: m.student.studentCode,
          fullName: m.student.user.fullName,
          email: m.student.user.email,
          phone: m.student.user.phone,
          isLeader: m.isLeader,
        })),
        latestSubmission: g.submissions[0]
          ? {
              id: g.submissions[0].id,
              title: g.submissions[0].report?.title || g.submissions[0].fileName || 'Bài nộp',
              submittedAt: g.submissions[0].submittedAt,
              status: g.submissions[0].status,
              submitter: g.submissions[0].submitter?.fullName,
            }
          : null,
        defense: g.defenses[0]
          ? {
              id: g.defenses[0].id,
              status: g.defenses[0].status,
              startsAt: g.defenses[0].startsAt,
              room: g.defenses[0].room,
              committeeName: g.defenses[0].committee?.name,
            }
          : null,
      };
    });

    const groupsByProgress = {
      HOAN_THANH: analyzedGroups.filter((g) => g.progressCategory === 'HOAN_THANH'),
      DANG_THUC_HIEN: analyzedGroups.filter((g) => g.progressCategory === 'DANG_THUC_HIEN'),
      QUA_HAN: analyzedGroups.filter((g) => g.progressCategory === 'QUA_HAN'),
      DUNG: analyzedGroups.filter((g) => g.progressCategory === 'DUNG'),
    };

    const avgProgress =
      analyzedGroups.length > 0
        ? Math.round(
            analyzedGroups.reduce((sum, g) => sum + g.progressPercent, 0) / analyzedGroups.length,
          )
        : 0;

    return {
      semester: {
        id: semester.id,
        code: semester.code,
        name: semester.name,
        status: semester.status,
      },
      summary: {
        totalGroups: groups.length,
        completedGroupsCount: groupsByProgress.HOAN_THANH.length,
        inProgressGroupsCount: groupsByProgress.DANG_THUC_HIEN.length,
        overdueGroupsCount: groupsByProgress.QUA_HAN.length,
        stoppedGroupsCount: groupsByProgress.DUNG.length,
        averageProgressPercent: avgProgress,
        onTrackRate:
          groups.length > 0
            ? Math.round(
                ((groupsByProgress.HOAN_THANH.length + groupsByProgress.DANG_THUC_HIEN.length) /
                  groups.length) *
                  100,
              )
            : 0,
      },
      groups: groupsByProgress,
    };
  }

  /**
   * 3. GET /statistics/milestones?semesterId=
   * Thống kê chi tiết theo 5 mốc quan trọng (Nộp giữa kỳ, Đánh giá giữa kỳ,
   * Nộp báo cáo cuối & mã nguồn, Phản biện, Bảo vệ) kèm danh sách nhóm theo từng mốc.
   */
  async getMilestones(semesterId?: string) {
    const semester = await this.resolveSemester(semesterId);

    const groups = await this.prisma.group.findMany({
      where: { semesterId: semester.id, status: { not: 'CANCELLED' } },
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
          orderBy: { isLeader: 'desc' },
        },
        reports: {
          include: {
            submissions: true,
          },
        },
        submissions: {
          include: { report: true },
        },
        reviewerAssignments: true,
        defenses: true,
        scores: true,
      },
      orderBy: { code: 'asc' },
    });

    const now = new Date();
    const regTo = semester.registrationTo ? new Date(semester.registrationTo) : null;
    const subTo = semester.submissionTo ? new Date(semester.submissionTo) : null;
    const defFrom = semester.defenseFrom ? new Date(semester.defenseFrom) : null;
    const defTo = semester.defenseTo ? new Date(semester.defenseTo) : null;

    let defaultMidtermDue: Date | null = null;
    if (regTo && subTo) {
      defaultMidtermDue = new Date((regTo.getTime() + subTo.getTime()) / 2);
    }
    const defaultMidtermConfirmDue = defaultMidtermDue
      ? new Date(defaultMidtermDue.getTime() + 7 * 86400000)
      : null;
    const defaultFinalDue = subTo;
    const defaultReviewDue = subTo && defFrom
      ? new Date((subTo.getTime() + defFrom.getTime()) / 2)
      : defFrom
      ? new Date(defFrom.getTime() - 3 * 86400000)
      : null;
    const defaultDefenseDue = defTo || defFrom;

    const groupSummaryMapping = (g: any) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      midtermStatus: g.midtermStatus,
      topicTitle: g.topic?.title ?? '—',
      advisorName: g.topic?.owner?.fullName ?? 'Giảng viên',
      membersCount: g.members.length,
      members: g.members.map((m: any) => ({
        studentCode: m.student.studentCode,
        fullName: m.student.user.fullName,
        isLeader: m.isLeader,
      })),
    });

    // 5 Milestones
    const milestones = [
      {
        key: 'MIDTERM_SUBMISSION',
        name: 'Nộp báo cáo giữa kỳ',
        deadline: defaultMidtermDue,
        evaluate: (g: any) => {
          const hasMidtermSub = g.submissions.some(
            (s: any) => s.report?.reportType === 'MIDTERM' || s.type === 'BAO_CAO_GIUA_KY',
          );
          if (hasMidtermSub || g.midtermStatus === 'CONTINUE' || g.midtermStatus === 'STOPPED') {
            return 'HOAN_THANH';
          }
          if (defaultMidtermDue && now > defaultMidtermDue) {
            return 'QUA_HAN';
          }
          return 'DANG_THUC_HIEN';
        },
      },
      {
        key: 'MIDTERM_EVALUATION',
        name: 'Đánh giá giữa kỳ của GVHD',
        deadline: defaultMidtermConfirmDue,
        evaluate: (g: any) => {
          if (g.midtermStatus === 'CONTINUE' || g.midtermStatus === 'STOPPED') {
            return 'HOAN_THANH';
          }
          if (defaultMidtermConfirmDue && now > defaultMidtermConfirmDue) {
            return 'QUA_HAN';
          }
          return 'DANG_THUC_HIEN';
        },
      },
      {
        key: 'FINAL_SUBMISSION',
        name: 'Nộp báo cáo cuối kỳ & mã nguồn',
        deadline: defaultFinalDue,
        evaluate: (g: any) => {
          const hasFinalSub = g.submissions.some(
            (s: any) =>
              s.report?.reportType === 'FINAL' ||
              s.report?.reportType === 'SOURCE_CODE' ||
              s.type === 'BAO_CAO_CUOI_KY' ||
              s.type === 'MA_NGUON',
          );
          if (hasFinalSub) return 'HOAN_THANH';
          if (g.midtermStatus === 'STOPPED') return 'DANG_THUC_HIEN';
          if (defaultFinalDue && now > defaultFinalDue) return 'QUA_HAN';
          return 'DANG_THUC_HIEN';
        },
      },
      {
        key: 'REVIEW',
        name: 'Chấm điểm phản biện',
        deadline: defaultReviewDue,
        evaluate: (g: any) => {
          const hasReview = g.scores.length > 0 || g.reviewerAssignments.length > 0;
          if (hasReview) return 'HOAN_THANH';
          if (g.midtermStatus === 'STOPPED') return 'DANG_THUC_HIEN';
          if (defaultReviewDue && now > defaultReviewDue) return 'QUA_HAN';
          return 'DANG_THUC_HIEN';
        },
      },
      {
        key: 'DEFENSE',
        name: 'Bảo vệ khóa luận tốt nghiệp',
        deadline: defaultDefenseDue,
        evaluate: (g: any) => {
          const hasDefense = g.defenses.some((d: any) => d.status === 'COMPLETED');
          if (hasDefense) return 'HOAN_THANH';
          if (g.midtermStatus === 'STOPPED') return 'DANG_THUC_HIEN';
          if (defaultDefenseDue && now > defaultDefenseDue) return 'QUA_HAN';
          return 'DANG_THUC_HIEN';
        },
      },
    ];

    const milestoneResults = milestones.map((m) => {
      const groupsMap: Record<'HOAN_THANH' | 'DANG_THUC_HIEN' | 'QUA_HAN' | 'CHUA_BAT_DAU', any[]> = {
        HOAN_THANH: [],
        DANG_THUC_HIEN: [],
        QUA_HAN: [],
        CHUA_BAT_DAU: [],
      };

      groups.forEach((g) => {
        const status = m.evaluate(g) as 'HOAN_THANH' | 'DANG_THUC_HIEN' | 'QUA_HAN' | 'CHUA_BAT_DAU';
        groupsMap[status].push(groupSummaryMapping(g));
      });

      return {
        key: m.key,
        name: m.name,
        deadline: m.deadline,
        summary: {
          total: groups.length,
          completed: groupsMap.HOAN_THANH.length,
          inProgress: groupsMap.DANG_THUC_HIEN.length,
          overdue: groupsMap.QUA_HAN.length,
          notStarted: groupsMap.CHUA_BAT_DAU.length,
          completionRate:
            groups.length > 0
              ? Math.round((groupsMap.HOAN_THANH.length / groups.length) * 100)
              : 0,
        },
        groups: groupsMap,
      };
    });

    return {
      semester: {
        id: semester.id,
        code: semester.code,
        name: semester.name,
        status: semester.status,
      },
      totalGroups: groups.length,
      milestones: milestoneResults,
    };
  }

  /**
   * 4. GET /statistics/midterm-results?semesterId=
   * Báo cáo kết quả đánh giá giữa kỳ: nhóm tiếp tục (CONTINUE),
   * nhóm dừng (STOPPED), nhóm chờ đánh giá (PENDING).
   */
  async getMidtermResults(semesterId?: string) {
    const semester = await this.resolveSemester(semesterId);

    const groups = await this.prisma.group.findMany({
      where: {
        semesterId: semester.id,
        status: { not: 'CANCELLED' },
      },
      include: {
        topic: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                lecturerProfile: { select: { lecturerCode: true, title: true } },
              },
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
          orderBy: { isLeader: 'desc' },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          include: { report: true },
        },
      },
      orderBy: [{ midtermStatus: 'asc' }, { code: 'asc' }],
    });

    const formatGroup = (g: any) => {
      const hasMidtermSubmission = g.submissions.some(
        (s: any) => s.report?.reportType === 'MIDTERM' || s.type === 'BAO_CAO_GIUA_KY',
      );
      return {
        id: g.id,
        code: g.code,
        name: g.name,
        status: g.status,
        midtermStatus: g.midtermStatus,
        midtermNote: g.midtermNote,
        midtermAt: g.midtermAt,
        hasMidtermSubmission,
        topic: g.topic
          ? {
              id: g.topic.id,
              title: g.topic.title,
              advisor: g.topic.owner?.fullName,
              advisorEmail: g.topic.owner?.email,
              advisorPhone: g.topic.owner?.phone,
              advisorCode: g.topic.owner?.lecturerProfile?.lecturerCode,
            }
          : null,
        members: g.members.map((m: any) => ({
          studentId: m.studentId,
          studentCode: m.student.studentCode,
          fullName: m.student.user.fullName,
          email: m.student.user.email,
          phone: m.student.user.phone,
          isLeader: m.isLeader,
        })),
      };
    };

    const continueList = groups
      .filter((g) => g.midtermStatus === 'CONTINUE')
      .map(formatGroup);
    const stoppedList = groups
      .filter((g) => g.midtermStatus === 'STOPPED')
      .map(formatGroup);
    const pendingList = groups
      .filter((g) => g.midtermStatus === 'PENDING')
      .map(formatGroup);

    const evaluatedCount = continueList.length + stoppedList.length;

    return {
      semester: {
        id: semester.id,
        code: semester.code,
        name: semester.name,
        status: semester.status,
      },
      summary: {
        totalGroups: groups.length,
        continueCount: continueList.length,
        stoppedCount: stoppedList.length,
        pendingCount: pendingList.length,
        evaluatedCount,
        evaluationRate:
          groups.length > 0 ? Math.round((evaluatedCount / groups.length) * 100) : 0,
        continueRate:
          evaluatedCount > 0 ? Math.round((continueList.length / evaluatedCount) * 100) : 0,
        stoppedRate:
          evaluatedCount > 0 ? Math.round((stoppedList.length / evaluatedCount) * 100) : 0,
      },
      groupsByResult: {
        CONTINUE: continueList,
        STOPPED: stoppedList,
        PENDING: pendingList,
      },
    };
  }

  /**
   * 5. GET /statistics/workload?semesterId=
   * Thống kê số nhóm hướng dẫn / phản biện theo từng GV kèm hạn mức và cảnh báo quá tải
   */
  async getWorkload(semesterId?: string) {
    const semester = await this.resolveSemester(semesterId);

    const lecturers = await this.prisma.lecturerProfile.findMany({
      where: semester.departmentId ? { departmentId: semester.departmentId } : undefined,
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        department: { select: { id: true, code: true, name: true } },
        reviewerAssignments: {
          where: { group: { semesterId: semester.id } },
          include: {
            group: {
              select: {
                id: true,
                code: true,
                name: true,
                topic: { select: { title: true } },
              },
            },
          },
        },
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    const lecturerStats = await Promise.all(
      lecturers.map(async (lecturer) => {
        // Nhóm hướng dẫn (GVHD là owner đề tài của nhóm trong học kỳ này)
        const guidedGroups = await this.prisma.group.findMany({
          where: {
            semesterId: semester.id,
            status: { not: 'CANCELLED' },
            topic: { ownerId: lecturer.userId },
          },
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            topic: { select: { title: true } },
          },
        });

        // Nhóm phản biện (GVPB)
        const reviewedGroups = lecturer.reviewerAssignments.map((ra) => ({
          id: ra.group.id,
          code: ra.group.code,
          name: ra.group.name,
          topicTitle: ra.group.topic?.title,
          type: ra.type,
        }));

        // Đề tài đề xuất
        const topicsCount = await this.prisma.topic.count({
          where: {
            ownerId: lecturer.userId,
            semesterId: semester.id,
          },
        });

        // Hội đồng bảo vệ tham gia
        const committeesCount = await this.prisma.defenseCommitteeMember.count({
          where: {
            userId: lecturer.userId,
            committee: {
              schedules: { some: { semesterId: semester.id } },
            },
          },
        });

        const maxGroups = lecturer.maxGroups || 5;
        const guidedGroupsCount = guidedGroups.length;
        const reviewedGroupsCount = reviewedGroups.length;
        const remainingSlots = Math.max(0, maxGroups - guidedGroupsCount);
        const isOverloaded = guidedGroupsCount >= maxGroups;

        return {
          id: lecturer.id,
          userId: lecturer.userId,
          fullName: lecturer.user?.fullName || 'Chưa cập nhật',
          email: lecturer.user?.email,
          phone: lecturer.user?.phone,
          lecturerCode: lecturer.lecturerCode,
          title: lecturer.title ?? 'Giảng viên',
          departmentName: lecturer.department?.name,
          maxGroups,
          guidedGroupsCount,
          guidedGroups: guidedGroups.map((g) => ({
            id: g.id,
            code: g.code,
            name: g.name,
            topicTitle: g.topic?.title,
            status: g.status,
          })),
          reviewedGroupsCount,
          reviewedGroups,
          committeesCount,
          topicsCount,
          remainingSlots,
          isOverloaded,
        };
      }),
    );

    const totalGuided = lecturerStats.reduce((sum, l) => sum + l.guidedGroupsCount, 0);
    const totalReviewed = lecturerStats.reduce((sum, l) => sum + l.reviewedGroupsCount, 0);
    const overloadedCount = lecturerStats.filter((l) => l.isOverloaded).length;
    const totalAvailableSlots = lecturerStats.reduce((sum, l) => sum + l.remainingSlots, 0);

    return {
      semester: {
        id: semester.id,
        code: semester.code,
        name: semester.name,
        status: semester.status,
      },
      summary: {
        totalLecturers: lecturerStats.length,
        totalGuidedGroups: totalGuided,
        totalReviewedGroups: totalReviewed,
        averageGuidedPerLecturer:
          lecturerStats.length > 0 ? Number((totalGuided / lecturerStats.length).toFixed(1)) : 0,
        averageReviewedPerLecturer:
          lecturerStats.length > 0 ? Number((totalReviewed / lecturerStats.length).toFixed(1)) : 0,
        overloadedLecturersCount: overloadedCount,
        availableSlotsTotal: totalAvailableSlots,
      },
      items: lecturerStats,
    };
  }
}
