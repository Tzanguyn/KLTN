import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoresService } from '../scores/scores.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoresService: ScoresService,
  ) {}

  /**
   * Helper xác định đợt KLTN mục tiêu
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

    // 1. Ưu tiên đợt KLTN chính thức đang mở (không phải đợt test tự động SEM_DEF_)
    const officialSemester = await this.prisma.semester.findFirst({
      where: {
        status: 'OPEN',
        NOT: { code: { startsWith: 'SEM_DEF_' } },
      },
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    if (officialSemester) return officialSemester;

    // 2. Fallback đợt OPEN bất kỳ nếu không có đợt chính thức
    const activeSemester = await this.prisma.semester.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    if (activeSemester) return activeSemester;

    // 3. Fallback đợt mới nhất trong hệ thống
    const latest = await this.prisma.semester.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    if (!latest) throw new NotFoundException('Chưa có đợt KLTN nào trong hệ thống');
    return latest;
  }

  /**
   * Chuẩn hóa và đồng bộ dữ liệu lộ trình 5 giai đoạn của Đợt KLTN giữa tất cả các Actor
   */
  async formatSemesterWithTimeline(semester: any) {
    if (!semester) return null;

    const now = new Date();
    const regFrom = semester.registrationFrom ? new Date(semester.registrationFrom) : null;
    const regTo = semester.registrationTo ? new Date(semester.registrationTo) : null;
    const subTo = semester.submissionTo ? new Date(semester.submissionTo) : null;
    const defFrom = semester.defenseFrom ? new Date(semester.defenseFrom) : null;
    const defTo = semester.defenseTo ? new Date(semester.defenseTo) : null;

    // Khoảng thời gian ước tính giữa kỳ
    let midFrom: Date | null = null;
    let midTo: Date | null = null;
    if (regTo && subTo) {
      const midTime = (regTo.getTime() + subTo.getTime()) / 2;
      midFrom = new Date(regTo.getTime() + 7 * 86400000);
      midTo = new Date(midTime);
    }

    // 1. Kiểm tra cấu hình ghi đè bước thủ công từ Trưởng BM / Quản lý BM nếu có
    const manualConfig = await this.prisma.systemConfig.findFirst({
      where: {
        OR: [
          { key: 'SEMESTER_TIMELINE_STEP', semesterId: semester.id },
          { key: `SEMESTER_TIMELINE_STEP_${semester.id}` },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    let currentStep = manualConfig?.value ? Number(manualConfig.value) : 0;

    if (!manualConfig?.value || isNaN(currentStep) || currentStep < 1 || currentStep > 5) {
      if (semester.status === 'ARCHIVED' || semester.status === 'CLOSED') {
        currentStep = 5;
      } else {
        // A. Tính bước theo mốc thời gian (Date-based)
        let stepFromDate = 1;
        if (defFrom && now >= defFrom) {
          stepFromDate = 5;
        } else if (subTo && now >= subTo) {
          stepFromDate = 4;
        } else if (midTo && now >= midTo) {
          stepFromDate = 3;
        } else if (regTo && now > regTo) {
          stepFromDate = 2;
        } else {
          stepFromDate = 1;
        }

        // B. Tính bước theo dữ liệu thực tế (Data-driven: defenses, scores, reviewers, groups, registrations)
        let stepFromData = 1;
        if (semester.id) {
          const [defCount, scoreCount, revCount, contGroupCount, grpCount, regApprovedCount] = await Promise.all([
            this.prisma.defenseSchedule.count({ where: { semesterId: semester.id } }),
            this.prisma.score.count({ where: { group: { semesterId: semester.id } } }),
            this.prisma.reviewerAssignment.count({ where: { group: { semesterId: semester.id } } }),
            this.prisma.group.count({
              where: {
                semesterId: semester.id,
                midtermStatus: 'CONTINUE',
                status: { not: 'CANCELLED' },
              },
            }),
            this.prisma.group.count({
              where: {
                semesterId: semester.id,
                status: { in: ['ACTIVE', 'COMPLETED', 'FORMING'] },
              },
            }),
            this.prisma.registration.count({
              where: {
                semesterId: semester.id,
                status: 'APPROVED',
              },
            }),
          ]);

          if (defCount > 0 || scoreCount > 0) {
            stepFromData = 5; // Bảo vệ & Tổng kết
          } else if (revCount > 0 || contGroupCount > 0) {
            stepFromData = 4; // Báo cáo & Phản biện
          } else if (grpCount > 0) {
            stepFromData = 3; // Thực hiện & Giữa kỳ
          } else if (regApprovedCount > 0) {
            stepFromData = 2; // Duyệt & Ghép nhóm
          } else {
            stepFromData = 1; // Đăng ký đề tài
          }
        }

        currentStep = Math.max(stepFromDate, stepFromData);
      }
    }

    const stageTitles = [
      'Đăng ký đề tài',
      'Duyệt & Ghép nhóm',
      'Thực hiện & Giữa kỳ',
      'Báo cáo & Phản biện',
      'Bảo vệ & Tổng kết',
    ];

    const timelineSteps = [
      {
        number: 1,
        title: 'Đăng ký đề tài',
        subtitle: 'Mở đợt, chọn hoặc đề xuất đề tài mới',
        phase: 'Tuần 1 - 3',
        startDate: regFrom ? regFrom.toISOString() : null,
        endDate: regTo ? regTo.toISOString() : null,
      },
      {
        number: 2,
        title: 'Duyệt & Ghép nhóm',
        subtitle: 'GVHD duyệt, thành lập nhóm KLTN',
        phase: 'Tuần 3 - 4',
        startDate: regTo ? regTo.toISOString() : null,
        endDate: midFrom ? midFrom.toISOString() : null,
      },
      {
        number: 3,
        title: 'Thực hiện & Giữa kỳ',
        subtitle: 'Báo cáo tiến độ, đánh giá giữa kỳ',
        phase: 'Tuần 5 - 10',
        startDate: midFrom ? midFrom.toISOString() : null,
        endDate: subTo ? subTo.toISOString() : null,
      },
      {
        number: 4,
        title: 'Báo cáo & Phản biện',
        subtitle: 'Nộp báo cáo hoàn chỉnh, GV phản biện',
        phase: 'Tuần 11 - 13',
        startDate: subTo ? subTo.toISOString() : null,
        endDate: defFrom ? defFrom.toISOString() : null,
      },
      {
        number: 5,
        title: 'Bảo vệ & Tổng kết',
        subtitle: 'Hội đồng chấm điểm 10 tiêu chí, NCKH',
        phase: 'Tuần 14 - 15',
        startDate: defFrom ? defFrom.toISOString() : null,
        endDate: defTo ? defTo.toISOString() : null,
      },
    ];

    return {
      id: semester.id,
      code: semester.code,
      name: semester.name,
      academicYear: semester.academicYear,
      status: semester.status,
      registrationFrom: semester.registrationFrom,
      registrationTo: semester.registrationTo,
      submissionTo: semester.submissionTo,
      defenseFrom: semester.defenseFrom,
      defenseTo: semester.defenseTo,
      currentStep,
      currentStage: stageTitles[currentStep - 1] || 'Đăng ký đề tài',
      timelineSteps,
    };
  }

  /**
   * Xác định vai trò chính của user từ token
   */
  resolveRole(userRoles: string[], requestedRole?: string): RoleCode {
    if (requestedRole) {
      if (userRoles.includes(requestedRole)) {
        return requestedRole as RoleCode;
      }
      // Trưởng bộ môn & Quản lý bộ môn kế thừa chức năng của giảng viên -> cho phép xem dashboard giảng viên
      if (
        (userRoles.includes(RoleCode.TRUONG_BO_MON) || userRoles.includes(RoleCode.QUAN_LY_BO_MON)) &&
        requestedRole === RoleCode.GIANG_VIEN
      ) {
        return RoleCode.GIANG_VIEN;
      }
    }

    // Thứ tự ưu tiên nhận diện vai trò: TRUONG_BO_MON > QUAN_LY_BO_MON > GIANG_VIEN > SINH_VIEN
    if (userRoles.includes(RoleCode.TRUONG_BO_MON)) return RoleCode.TRUONG_BO_MON;
    if (userRoles.includes(RoleCode.QUAN_LY_BO_MON)) return RoleCode.QUAN_LY_BO_MON;
    if (userRoles.includes(RoleCode.GIANG_VIEN)) return RoleCode.GIANG_VIEN;
    return RoleCode.SINH_VIEN;
  }

  /**
   * GET /dashboard
   * Tự động detect role của người dùng và trả về dữ liệu tương ứng
   */
  async getDashboard(user: { id: string; email: string; roles: string[] }, semesterId?: string, requestedRole?: string) {
    const semester = await this.resolveSemester(semesterId);
    const role = this.resolveRole(user.roles, requestedRole);

    const baseUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, fullName: true, phone: true },
    });

    switch (role) {
      case RoleCode.SINH_VIEN:
        return this.getStudentDashboard(baseUser, semester);
      case RoleCode.GIANG_VIEN:
        return this.getLecturerDashboard(baseUser, semester);
      case RoleCode.TRUONG_BO_MON:
        return this.getHeadDashboard(baseUser, semester);
      case RoleCode.QUAN_LY_BO_MON:
        return this.getManagerDashboard(baseUser, semester);
      default:
        return this.getStudentDashboard(baseUser, semester);
    }
  }

  /**
   * Dashboard Sinh viên:
   * Trả về hồ sơ, thông tin nhóm, đề tài, GVHD, đánh giá giữa kỳ, lịch bảo vệ, điểm số và các việc cần làm.
   */
  private async getStudentDashboard(user: any, semester: any) {
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: { department: true },
    });

    // Thông tin đăng ký đề tài
    let registration = studentProfile
      ? await this.prisma.registration.findFirst({
          where: { studentId: studentProfile.id, semesterId: semester.id },
          include: {
            topic: {
              include: {
                owner: { select: { id: true, fullName: true, email: true, phone: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    if (!registration && studentProfile) {
      registration = await this.prisma.registration.findFirst({
        where: {
          studentId: studentProfile.id,
          status: { in: ['APPROVED', 'PENDING', 'CHO_XAC_NHAN'] },
        },
        include: {
          topic: {
            include: {
              owner: { select: { id: true, fullName: true, email: true, phone: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Nhóm KLTN của sinh viên
    let groupMember = studentProfile
      ? await this.prisma.groupMember.findFirst({
          where: {
            studentId: studentProfile.id,
            group: { semesterId: semester.id },
          },
          include: {
            group: {
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
                },
                submissions: {
                  orderBy: { submittedAt: 'desc' },
                  take: 5,
                },
              },
            },
          },
        })
      : null;

    if (!groupMember && studentProfile) {
      groupMember = await this.prisma.groupMember.findFirst({
        where: {
          studentId: studentProfile.id,
          group: { status: { not: 'CANCELLED' } },
        },
        include: {
          group: {
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
              },
              submissions: {
                orderBy: { submittedAt: 'desc' },
                take: 5,
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      });
    }

    const group: any = (groupMember as any)?.group || null;
    if (group && !group.topic && registration?.topic) {
      group.topic = registration.topic;
    }
    const defenseSchedule = group?.defenses?.[0] || null;

    // Lấy điểm số chi tiết nếu có nhóm
    let scoresData: any = null;
    if (group) {
      try {
        const allScores: any = await this.scoresService.findSemesterScores({ semesterId: semester.id, groupId: group.id }, user.id);
        scoresData = allScores?.items?.[0] || allScores?.[0] || null;
      } catch (err) {
        // Fallback nếu chưa có điểm
        scoresData = null;
      }
    }

    // Minh chứng NCKH của sinh viên
    const evidences = await this.prisma.evidence.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Xây dựng danh sách hành động cần làm (Action items)
    const actionItems: string[] = [];
    if (!studentProfile?.eligible) {
      actionItems.push('Hồ sơ hiện tại chưa đủ điều kiện làm KLTN (vui lòng liên hệ Văn phòng khoa/Bộ môn)');
    }

    const hasActiveTopicOrGroup = Boolean(
      group ||
      (registration && (registration.status === 'APPROVED' || registration.status === 'CHO_XAC_NHAN')) ||
      defenseSchedule ||
      group?.topic ||
      registration?.topic
    );

    if (!hasActiveTopicOrGroup) {
      if (!registration) {
        const now = new Date();
        if (semester.registrationTo && now > new Date(semester.registrationTo)) {
          actionItems.push('Đã hết hạn đăng ký đề tài KLTN cho đợt này');
        } else {
          actionItems.push('Chưa đăng ký đề tài KLTN. Vui lòng vào mục Đăng ký đề tài để chọn nguyện vọng');
        }
      } else if (registration.status === 'PENDING') {
        actionItems.push('Đơn đăng ký đề tài đang chờ Giảng viên / Bộ môn phê duyệt');
      } else if (registration.status === 'REJECTED') {
        actionItems.push('Đơn đăng ký đề tài đã bị từ chối. Vui lòng chọn đề tài khác hoặc đề xuất đề tài mới');
      }
    } else {
      if (registration && registration.status === 'PENDING') {
        actionItems.push('Đơn đăng ký đề tài đang chờ Giảng viên / Bộ môn phê duyệt');
      }
    }

    if (group) {
      if (group.midtermStatus === 'PENDING') {
        actionItems.push('Chờ kết quả đánh giá giữa kỳ từ Cán bộ Hướng dẫn');
      } else if (group.midtermStatus === 'STOPPED') {
        actionItems.push('Cảnh báo: Đề tài bị dừng thực hiện theo kết luận đánh giá giữa kỳ');
      } else if (group.midtermStatus === 'CONTINUE') {
        if (!defenseSchedule) {
          actionItems.push('Đã đủ điều kiện bảo vệ KLTN. Đang chờ Hội đồng xếp lịch bảo vệ');
        } else {
          const startsAtStr = new Date(defenseSchedule.startsAt).toLocaleString('vi-VN');
          actionItems.push(`Lịch bảo vệ chính thức: ${startsAtStr} tại Phòng ${defenseSchedule.room || 'Chưa xếp'}`);
        }
      }
    }

    const formattedSemester = await this.formatSemesterWithTimeline(semester);

    return {
      role: RoleCode.SINH_VIEN,
      user,
      semester: formattedSemester,
      studentProfile: studentProfile
        ? {
            id: studentProfile.id,
            studentCode: studentProfile.studentCode,
            major: studentProfile.department?.name || studentProfile.className || 'Công nghệ thông tin',
            gpa: studentProfile.gpa,
            credits: studentProfile.creditsEarned,
            eligible: studentProfile.eligible,
            departmentName: studentProfile.department?.name,
          }
        : null,
      registration: registration
        ? {
            id: registration.id,
            status: registration.status,
            createdAt: registration.createdAt,
            topic: {
              id: registration.topic?.id,
              title: registration.topic?.title,
              ownerName: registration.topic?.owner?.fullName,
              ownerEmail: registration.topic?.owner?.email,
            },
          }
        : null,
      group: group
        ? {
            id: group.id,
            code: group.code,
            name: group.name,
            status: group.status,
            topic: {
              id: group.topic?.id,
              title: group.topic?.title,
              advisorName: group.topic?.owner?.fullName,
              advisorEmail: group.topic?.owner?.email,
              advisorPhone: group.topic?.owner?.phone,
            },
            members: group.members.map((m: any) => ({
              id: m.student.id,
              userId: m.student.user.id,
              studentCode: m.student.studentCode,
              fullName: m.student.user.fullName,
              email: m.student.user.email,
              phone: m.student.user.phone,
              isLeader: m.isLeader,
            })),
            reviewers: group.reviewerAssignments.map((ra: any) => ({
              id: ra.lecturer.id,
              fullName: ra.lecturer.user.fullName,
              email: ra.lecturer.user.email,
              type: ra.type,
            })),
            midtermStatus: group.midtermStatus,
            midtermNote: group.midtermNote,
            midtermAt: group.midtermAt,
            submissions: group.submissions,
          }
        : null,
      defenseSchedule: defenseSchedule
        ? {
            id: defenseSchedule.id,
            room: defenseSchedule.room,
            startsAt: defenseSchedule.startsAt,
            endsAt: defenseSchedule.endsAt,
            status: defenseSchedule.status,
            committeeName: defenseSchedule.committee?.name,
            committeeMembers: defenseSchedule.committee?.members?.map((m: any) => ({
              fullName: m.user.fullName,
              role: m.role,
            })),
          }
        : null,
      scores: scoresData
        ? {
            scores: scoresData.scores,
            scoreBreakdown: scoresData.scoreBreakdown,
            finalScore: scoresData.finalScore,
            xepLoai: scoresData.xepLoai,
            ketQua: scoresData.ketQua,
            congThucTinh: scoresData.congThucTinh,
            scoreCompleteness: scoresData.scoreCompleteness,
          }
        : null,
      evidencesSummary: {
        total: evidences.length,
        approved: evidences.filter((e) => e.status === 'APPROVED').length,
        pending: evidences.filter((e) => e.status === 'PENDING').length,
      },
      actionItems,
    };
  }

  /**
   * Dashboard Giảng viên:
   * Thống kê đề tài hướng dẫn, phản biện, hạn mức, lịch hội đồng và việc cần làm.
   */
  private async getLecturerDashboard(user: any, semester: any) {
    let lecturerProfile = await this.prisma.lecturerProfile.findUnique({
      where: { userId: user.id },
      include: { department: true },
    });

    if (!lecturerProfile) {
      const defaultDept = await this.prisma.department.findFirst({
        where: { code: { in: ['IS', 'CNTT'] } },
      });
      if (defaultDept) {
        lecturerProfile = await this.prisma.lecturerProfile.create({
          data: {
            userId: user.id,
            lecturerCode: `GV_${user.id.slice(0, 6).toUpperCase()}`,
            title: 'ThS.',
            specialization: 'Hệ thống thông tin',
            departmentId: defaultDept.id,
            maxGroups: 10,
          },
          include: { department: true },
        });
      }
    }

    const maxGroups = lecturerProfile?.maxGroups || 5;

    // Đề tài của giảng viên trong học kỳ
    const topics = await this.prisma.topic.findMany({
      where: {
        ownerId: user.id,
        semesterId: semester.id,
      },
      select: {
        id: true,
        title: true,
        status: true,
        capacity: true,
        createdAt: true,
      },
    });

    // Nhóm hướng dẫn
    const guidedGroups = await this.prisma.group.findMany({
      where: {
        semesterId: semester.id,
        status: { not: 'CANCELLED' },
        topic: { ownerId: user.id },
      },
      include: {
        topic: { select: { title: true } },
        members: {
          include: {
            student: {
              include: {
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
        scores: {
          where: { scorerId: user.id },
        },
      },
    });

    // Nhóm phản biện
    const reviewingAssignments = lecturerProfile
      ? await this.prisma.reviewerAssignment.findMany({
          where: {
            lecturerId: lecturerProfile.id,
            group: { semesterId: semester.id, status: { not: 'CANCELLED' } },
          },
          include: {
            group: {
              include: {
                topic: {
                  include: {
                    owner: { select: { fullName: true, email: true } },
                  },
                },
                members: {
                  include: {
                    student: {
                      include: {
                        user: { select: { fullName: true, email: true } },
                      },
                    },
                  },
                },
                scores: {
                  where: { scorerId: user.id },
                },
              },
            },
          },
        })
      : [];

    // Hội đồng bảo vệ tham gia
    const committeeMemberships = await this.prisma.defenseCommitteeMember.findMany({
      where: {
        userId: user.id,
        committee: {
          schedules: { some: { semesterId: semester.id } },
        },
      },
      include: {
        committee: {
          include: {
            schedules: {
              where: { semesterId: semester.id },
              include: {
                group: {
                  include: {
                    topic: { select: { title: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Yêu cầu mở khóa điểm của giảng viên
    const scoreUnlockRequests = await this.prisma.scoreChangeRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const guidedCount = guidedGroups.length;
    const reviewedCount = reviewingAssignments.length;
    const remainingSlots = Math.max(0, maxGroups - guidedCount);

    // Tính số nhóm chưa chấm điểm
    const unratedGuidedCount = guidedGroups.filter((g: any) => g.scores.length < 10 || g.scores.some((s: any) => s.status === 'DRAFT')).length;
    const unratedReviewCount = reviewingAssignments.filter((ra: any) => ra.group.scores.length < 10 || ra.group.scores.some((s: any) => s.status === 'DRAFT')).length;

    // Action items
    const actionItems: string[] = [];
    if (unratedGuidedCount > 0) {
      actionItems.push(`Có ${unratedGuidedCount} nhóm hướng dẫn chưa hoàn thành khóa điểm (cần chấm đủ 10 tiêu chí)`);
    }
    if (unratedReviewCount > 0) {
      actionItems.push(`Có ${unratedReviewCount} nhóm phản biện được phân công chưa hoàn tất nhập điểm`);
    }
    if (committeeMemberships.length > 0) {
      actionItems.push(`Đang tham gia ${committeeMemberships.length} Hội đồng chấm bảo vệ KLTN`);
    }

    const formattedSemester = await this.formatSemesterWithTimeline(semester);

    return {
      role: RoleCode.GIANG_VIEN,
      user,
      semester: formattedSemester,
      summary: {
        topicsCount: topics.length,
        approvedTopicsCount: topics.filter((t: any) => t.status === 'APPROVED' || (t.status as any) === 'DA_DUYET').length,
        pendingTopicsCount: topics.filter((t: any) => t.status === 'CHO_DUYET' || (t.status as any) === 'CHO_TRUONG_BM_DUYET').length,
        guidedGroupsCount: guidedCount,
        maxGuidingGroups: maxGroups,
        remainingGuidingSlots: remainingSlots,
        isOverloaded: guidedCount >= maxGroups,
        reviewedGroupsCount: reviewedCount,
        unratedGuidedCount,
        unratedReviewCount,
        committeesCount: committeeMemberships.length,
      },
      guidingGroups: guidedGroups.map((g: any) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        topicTitle: g.topic?.title,
        members: g.members.map((m: any) => m.student.user.fullName),
        midtermStatus: g.midtermStatus,
        scoresCount: g.scores.length,
        isDraft: g.scores.some((s: any) => s.status === 'DRAFT'),
        isComplete: g.scores.length >= 10 && !g.scores.some((s: any) => s.status === 'DRAFT'),
      })),
      reviewingGroups: reviewingAssignments.map((ra: any) => ({
        id: ra.group.id,
        code: ra.group.code,
        name: ra.group.name,
        topicTitle: ra.group.topic?.title,
        advisorName: ra.group.topic?.owner?.fullName,
        members: ra.group.members.map((m: any) => m.student.user.fullName),
        type: ra.type,
        scoresCount: ra.group.scores.length,
        isDraft: ra.group.scores.some((s: any) => s.status === 'DRAFT'),
        isComplete: ra.group.scores.length >= 10 && !ra.group.scores.some((s: any) => s.status === 'DRAFT'),
      })),
      defenseCommittees: committeeMemberships.map((cm) => ({
        id: cm.committee.id,
        name: cm.committee.name,
        role: cm.role,
        schedulesCount: cm.committee.schedules.length,
        schedules: cm.committee.schedules.map((s) => ({
          id: s.id,
          groupCode: s.group?.code,
          topicTitle: s.group?.topic?.title,
          room: s.room,
          startsAt: s.startsAt,
        })),
      })),
      recentUnlockRequests: scoreUnlockRequests.map((r) => ({
        id: r.id,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
      })),
      actionItems,
    };
  }

  /**
   * Dashboard Trưởng bộ môn:
   * Bức tranh chuyên môn toàn bộ môn: đề tài chờ duyệt, phản biện, hội đồng, mở khóa điểm, minh chứng NCKH, cảnh báo thiếu điểm.
   */
  private async getHeadDashboard(user: any, semester: any) {
    const [
      pendingTopics,
      allGroups,
      scoreRequests,
      pendingEvidence,
      committees,
      schedules,
    ] = await Promise.all([
      this.prisma.topic.findMany({
        where: {
          semesterId: semester.id,
          status: { in: ['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'PENDING_APPROVAL', 'CAN_CAP_NHAT'] },
        },
        include: {
          owner: { select: { fullName: true, email: true } },
          department: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.group.findMany({
        where: { semesterId: semester.id, status: { not: 'CANCELLED' } },
        include: {
          topic: { select: { ownerId: true } },
          reviewerAssignments: true,
          defenses: { where: { status: { not: 'CANCELLED' } } },
        },
      }),
      this.prisma.scoreChangeRequest.findMany({
        where: { status: 'PENDING' },
        include: {
          requester: { select: { fullName: true, email: true } },
          group: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.evidence.findMany({
        where: { status: 'PENDING' },
        include: {
          user: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.defenseCommittee.findMany({
        where: semester.departmentId ? { departmentId: semester.departmentId } : undefined,
      }),
      this.prisma.defenseSchedule.findMany({
        where: { semesterId: semester.id },
      }),
    ]);

    // Thống kê nhóm
    const unassignedReviewersCount = allGroups.filter((g: any) => g.reviewerAssignments.length === 0).length;
    const readyForDefenseCount = allGroups.filter((g: any) => g.midtermStatus === 'CONTINUE' || (g.midtermStatus as any) === 'CHO_LAM_TIEP').length;
    const scheduledDefenseCount = allGroups.filter((g: any) => g.defenses.length > 0).length;

    // Lấy thống kê bảng điểm và cảnh báo thiếu điểm
    let incompleteScoresCount = 0;
    try {
      const scores: any = await this.scoresService.findSemesterScores({ semesterId: semester.id });
      const scoreItems = scores?.items || (Array.isArray(scores) ? scores : []);
      incompleteScoresCount = scoreItems.filter((s: any) => s.scoreCompleteness?.hasWarning).length;
    } catch {
      incompleteScoresCount = 0;
    }

    const actionItems: string[] = [];
    if (pendingTopics.length > 0) {
      actionItems.push(`Có ${pendingTopics.length} đề tài mới đang chờ Trưởng bộ môn phê duyệt`);
    }
    if (scoreRequests.length > 0) {
      actionItems.push(`Có ${scoreRequests.length} yêu cầu mở khóa điểm từ Giảng viên đang chờ duyệt`);
    }
    if (pendingEvidence.length > 0) {
      actionItems.push(`Có ${pendingEvidence.length} hồ sơ minh chứng NCKH của sinh viên đang chờ thẩm định`);
    }
    if (unassignedReviewersCount > 0) {
      actionItems.push(`Còn ${unassignedReviewersCount} nhóm KLTN chưa được phân công Giảng viên phản biện`);
    }
    if (incompleteScoresCount > 0) {
      actionItems.push(`Có ${incompleteScoresCount} nhóm KLTN còn cảnh báo thiếu điểm thành phần`);
    }

    const formattedSemester = await this.formatSemesterWithTimeline(semester);

    return {
      role: RoleCode.TRUONG_BO_MON,
      user,
      semester: formattedSemester,
      summary: {
        pendingTopicsCount: pendingTopics.length,
        totalGroupsCount: allGroups.length,
        unassignedReviewersCount,
        readyForDefenseCount,
        scheduledDefenseCount,
        pendingScoreUnlocksCount: scoreRequests.length,
        pendingEvidenceCount: pendingEvidence.length,
        defenseCommitteesCount: committees.length,
        defenseSchedulesCount: schedules.length,
        incompleteScoresCount,
      },
      recentPendingTopics: pendingTopics.slice(0, 5).map((t: any) => ({
        id: t.id,
        title: t.title,
        ownerName: t.owner?.fullName,
        ownerEmail: t.owner?.email,
        status: t.status,
        createdAt: t.createdAt,
      })),
      recentScoreRequests: scoreRequests.slice(0, 5).map((r: any) => ({
        id: r.id,
        lecturerName: r.requester?.fullName || r.lecturer?.fullName,
        groupCode: r.group?.code,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
      recentEvidence: pendingEvidence.slice(0, 5).map((e: any) => ({
        id: e.id,
        title: e.title,
        studentName: e.user?.fullName,
        type: e.type,
        createdAt: e.createdAt,
      })),
      actionItems,
    };
  }

  /**
   * Dashboard Quản lý bộ môn:
   * Giám sát vận hành đợt KLTN, số lượng sinh viên, tiến độ mốc, tình trạng đăng ký và xếp lịch.
   */
  private async getManagerDashboard(user: any, semester: any) {
    const [
      totalStudents,
      eligibleStudents,
      registrations,
      allGroups,
      schedules,
    ] = await Promise.all([
      this.prisma.studentProfile.count({
        where: semester.departmentId ? { departmentId: semester.departmentId } : undefined,
      }),
      this.prisma.studentProfile.count({
        where: {
          eligible: true,
          ...(semester.departmentId ? { departmentId: semester.departmentId } : {}),
        },
      }),
      this.prisma.registration.findMany({
        where: { semesterId: semester.id },
        select: { status: true },
      }),
      this.prisma.group.findMany({
        where: { semesterId: semester.id },
        select: { id: true, status: true, midtermStatus: true },
      }),
      this.prisma.defenseSchedule.count({
        where: { semesterId: semester.id },
      }),
    ]);

    const activeGroupsCount = allGroups.filter((g: any) => g.status === 'ACTIVE').length;
    const formingGroupsCount = allGroups.filter((g: any) => g.status === 'FORMING').length;
    const stoppedGroupsCount = allGroups.filter((g: any) => g.midtermStatus === 'STOPPED').length;
    const continueGroupsCount = allGroups.filter((g: any) => g.midtermStatus === 'CONTINUE' || (g.midtermStatus as any) === 'CHO_LAM_TIEP').length;

    const actionItems: string[] = [];
    if (formingGroupsCount > 0) {
      actionItems.push(`Có ${formingGroupsCount} nhóm KLTN vẫn đang trong trạng thái lập nhóm (FORMING)`);
    }
    if (stoppedGroupsCount > 0) {
      actionItems.push(`Có ${stoppedGroupsCount} nhóm KLTN bị dừng đề tài sau đợt đánh giá giữa kỳ`);
    }
    const unscheduledCount = Math.max(0, continueGroupsCount - schedules);
    if (unscheduledCount > 0) {
      actionItems.push(`Còn ${unscheduledCount} nhóm đủ điều kiện bảo vệ chưa được xếp lịch thi`);
    }

    const formattedSemester = await this.formatSemesterWithTimeline(semester);

    return {
      role: RoleCode.QUAN_LY_BO_MON,
      user,
      semester: formattedSemester,
      summary: {
        totalStudents,
        eligibleStudentsCount: eligibleStudents,
        registeredStudentsCount: registrations.length,
        totalGroupsCount: allGroups.length,
        formingGroupsCount,
        activeGroupsCount,
        continueGroupsCount,
        stoppedGroupsCount,
        scheduledDefensesCount: schedules,
      },
      registrationBreakdown: {
        APPROVED: registrations.filter((r: any) => r.status === 'APPROVED' || (r.status as any) === 'DA_DUYET').length,
        PENDING: registrations.filter((r: any) => r.status === 'PENDING' || (r.status as any) === 'CHO_DUYET' || (r.status as any) === 'CHO_XAC_NHAN').length,
        REJECTED: registrations.filter((r: any) => r.status === 'REJECTED' || (r.status as any) === 'TU_CHOI').length,
      },
      actionItems,
    };
  }
}

