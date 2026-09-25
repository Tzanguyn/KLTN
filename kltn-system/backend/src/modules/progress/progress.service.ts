import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleCode, SubmissionStatus } from '@prisma/client';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { QuerySubmissionsDto } from './dto/query-submissions.dto';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async groups(userId: string) {
    return this.prisma.group.findMany({
      where: {
        OR: [
          { members: { some: { student: { userId } } } },
          { topic: { ownerId: userId } },
        ],
      },
      include: {
        topic: true,
        members: {
          include: {
            student: { include: { user: { select: { fullName: true } } } },
          },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async reports(userId: string, groupId?: string) {
    return this.prisma.progressReport.findMany({
      where: groupId ? { groupId } : { authorId: userId },
      include: {
        submissions: { include: { feedbacks: true } },
        group: { include: { topic: true } },
      },
    });
  }

  async submissions(userId: string, groupId?: string) {
    return this.prisma.submission.findMany({
      where: groupId ? { groupId } : { submittedBy: userId },
      include: {
        report: true,
        feedbacks: {
          include: { author: { select: { fullName: true } } },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateReportDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    const allowed = student
      ? group.members.some((member) => member.studentId === student.id)
      : false;
    if (!allowed) {
      const lecturer = await this.prisma.lecturerProfile.findUnique({ where: { userId } });
      if (!lecturer) throw new BadRequestException('Bạn không thuộc nhóm này');
    }
    return this.prisma.progressReport.create({
      data: { ...dto, authorId: userId },
      include: { group: true },
    });
  }

  async submit(userId: string, reportId: string, file?: any, sourceUrl?: string, note?: string) {
    const report = await this.prisma.progressReport.findUnique({
      where: { id: reportId },
      include: { group: { include: { members: true } } },
    });
    if (!report) throw new NotFoundException('Không tìm thấy báo cáo');
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student || !report.group.members.some((member) => member.studentId === student.id)) {
      throw new BadRequestException('Bạn không thuộc nhóm của báo cáo');
    }

    return this.prisma.submission.create({
      data: {
        groupId: report.groupId,
        reportId,
        submittedBy: userId,
        fileName: file?.originalname,
        fileUrl: file?.path ? file.path.replace(/\\/g, '/') : file?.filename,
        fileSize: file?.size,
        sourceUrl,
        note,
      },
      include: { report: true },
    });
  }

  async createSubmission(userId: string, dto: CreateSubmissionDto, file?: any) {
    // 1. Validate file or link
    if (!file && !dto.link?.trim()) {
      throw new BadRequestException('Vui lòng đính kèm tệp tin hoặc đường dẫn liên kết (GitHub/Drive/Demo)');
    }

    // 2. Validate student profile
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!student) {
      throw new NotFoundException('Không tìm thấy hồ sơ sinh viên');
    }

    // 3. Resolve group / topic
    let targetGroupId = dto.groupId;
    let targetGroup: any = null;

    if (targetGroupId) {
      targetGroup = await this.prisma.group.findUnique({
        where: { id: targetGroupId },
        include: { topic: { include: { owner: true } }, members: true },
      });
      if (!targetGroup) {
        throw new NotFoundException('Không tìm thấy nhóm KLTN');
      }
      const isMember = targetGroup.members.some((m: any) => m.studentId === student.id);
      if (!isMember) {
        throw new BadRequestException('Bạn không thuộc nhóm KLTN này');
      }
    } else {
      // Find group membership
      const membership = await this.prisma.groupMember.findFirst({
        where: {
          studentId: student.id,
          group: dto.topicId ? { topicId: dto.topicId } : undefined,
        },
        include: { group: { include: { topic: { include: { owner: true } } } } },
      });

      if (membership) {
        targetGroup = membership.group;
        targetGroupId = targetGroup.id;
      } else {
        // Check active registration
        const registration = await this.prisma.registration.findFirst({
          where: {
            studentId: student.id,
            status: { in: ['APPROVED', 'CHO_XAC_NHAN', 'PENDING'] },
            ...(dto.topicId ? { topicId: dto.topicId } : {}),
          },
          include: {
            topic: { include: { owner: true } },
            group: { include: { topic: { include: { owner: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (registration?.groupId && registration.group) {
          targetGroup = registration.group;
          targetGroupId = targetGroup.id;
        } else if (registration?.topicId) {
          // Find or create active group for this topic & student
          let activeGroup = await this.prisma.group.findFirst({
            where: {
              topicId: registration.topicId,
              semesterId: registration.semesterId,
              status: { not: 'CANCELLED' },
            },
            include: { topic: { include: { owner: true } } },
          });

          if (!activeGroup) {
            activeGroup = await this.prisma.group.create({
              data: {
                code: `GRP-${Date.now().toString().slice(-6)}`,
                name: `Nhóm ${student.user.fullName}`,
                status: 'ACTIVE',
                topicId: registration.topicId,
                semesterId: registration.semesterId,
              },
              include: { topic: { include: { owner: true } } },
            });
          }

          await this.prisma.groupMember.upsert({
            where: {
              groupId_studentId: { groupId: activeGroup.id, studentId: student.id },
            },
            update: {},
            create: {
              groupId: activeGroup.id,
              studentId: student.id,
              isLeader: true,
            },
          });

          targetGroup = activeGroup;
          targetGroupId = targetGroup.id;
        }
      }
    }

    if (!targetGroupId || !targetGroup) {
      throw new BadRequestException('Bạn chưa được phân công nhóm hoặc đề tài KLTN để nộp bài');
    }

    // 4. Calculate version (version = max(version) + 1)
    const lastSub = await this.prisma.submission.findFirst({
      where: {
        groupId: targetGroupId,
        ...(dto.reportId ? { reportId: dto.reportId } : {}),
        ...(dto.type ? { type: dto.type } : {}),
      },
      orderBy: { version: 'desc' },
    });
    const version = (lastSub?.version ?? 0) + 1;

    // 5. Create Submission with status CHUA_XEM
    const created = await this.prisma.submission.create({
      data: {
        groupId: targetGroupId,
        reportId: dto.reportId || undefined,
        submittedBy: userId,
        fileName: file?.originalname || undefined,
        fileUrl: file?.path ? file.path.replace(/\\/g, '/') : file?.filename || undefined,
        fileSize: file?.size || undefined,
        sourceUrl: dto.link?.trim() || undefined,
        type: dto.type || 'BAO_CAO_TIEN_DO',
        note: dto.note?.trim() || undefined,
        version,
        status: 'CHUA_XEM' as any,
      },
      include: {
        group: {
          include: {
            topic: { include: { owner: true } },
          },
        },
        submitter: { select: { id: true, fullName: true, email: true } },
        report: true,
      },
    });

    // 6. Notifications
    const gvhdUserId = targetGroup.topic?.ownerId;
    const topicTitle = targetGroup.topic?.title || 'Đề tài KLTN';
    const submissionType = dto.type || 'Tài liệu / Báo cáo';

    if (gvhdUserId) {
      await this.notifications.create(
        gvhdUserId,
        'Sinh viên đã nộp bài mới',
        `Sinh viên ${student.user.fullName} (${student.studentCode}) đã nộp: ${submissionType} (v${version}) cho đề tài "${topicTitle}".`,
        'FEEDBACK',
      );
    }

    await this.notifications.create(
      userId,
      'Nộp bài thành công',
      `Bạn đã nộp thành công ${submissionType} (v${version}) cho đề tài "${topicTitle}". Trạng thái: Chưa xem (CHUA_XEM).`,
      'FEEDBACK',
    );

    return created;
  }

  async getMySubmissions(userId: string, topicId?: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return [];

    return this.prisma.submission.findMany({
      where: {
        group: {
          members: { some: { studentId: student.id } },
          ...(topicId ? { topicId } : {}),
        },
      },
      include: {
        submitter: { select: { id: true, fullName: true, email: true } },
        report: true,
        feedbacks: {
          include: {
            author: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        group: {
          include: {
            topic: { select: { id: true, title: true, ownerId: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async findSubmissions(userId: string, query: QuerySubmissionsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        studentProfile: true,
        lecturerProfile: true,
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const roleCodes = user.roles.map((r) => r.role.code);
    const isStudent = roleCodes.includes(RoleCode.SINH_VIEN);
    const isLecturer = roleCodes.includes(RoleCode.GIANG_VIEN);
    const isManager =
      roleCodes.includes(RoleCode.TRUONG_BO_MON) || roleCodes.includes(RoleCode.QUAN_LY_BO_MON);

    const where: any = {};

    // 1. Phân quyền và phạm vi truy cập
    if (isStudent) {
      if (!user.studentProfile) return [];
      where.group = {
        members: { some: { studentId: user.studentProfile.id } },
      };
    } else if (isLecturer && !isManager) {
      // Giảng viên hướng dẫn hoặc phản biện
      const lecturerConditions: any[] = [{ topic: { ownerId: userId } }];
      if (user.lecturerProfile) {
        lecturerConditions.push({
          reviewerAssignments: { some: { lecturerId: user.lecturerProfile.id } },
        });
      }
      where.group = { OR: lecturerConditions };
    }
    // TRUONG_BO_MON / QUAN_LY_BO_MON có thể xem tất cả bài nộp (không gán where.group mặc định)

    // 2. Lọc theo Topic
    if (query.topicId) {
      where.group = {
        ...(where.group || {}),
        topicId: query.topicId,
      };
    }

    // 3. Lọc theo Group
    if (query.groupId) {
      where.groupId = query.groupId;
    }

    // 4. Lọc theo Thời gian nộp bài
    const start = query.from || query.startDate;
    const end = query.to || query.endDate;
    if (start || end) {
      where.submittedAt = {};
      if (start) {
        const sDate = new Date(start);
        if (!isNaN(sDate.getTime())) {
          where.submittedAt.gte = sDate;
        }
      }
      if (end) {
        const eDate = new Date(end);
        if (!isNaN(eDate.getTime())) {
          // Nếu định dạng YYYY-MM-DD thì bao gồm cả ngày đến 23:59:59.999
          if (end.length === 10) {
            eDate.setHours(23, 59, 59, 999);
          }
          where.submittedAt.lte = eDate;
        }
      }
    }

    // 5. Lọc theo Trạng thái & Loại bài nộp
    if (query.status) {
      where.status = query.status;
    }
    if (query.type) {
      where.type = query.type;
    }

    return this.prisma.submission.findMany({
      where,
      include: {
        submitter: { select: { id: true, fullName: true, email: true } },
        report: true,
        feedbacks: {
          include: {
            author: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        group: {
          include: {
            topic: { select: { id: true, title: true, ownerId: true } },
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
      orderBy: { submittedAt: 'desc' },
    });
  }

  async downloadSubmission(
    userId: string,
    id: string,
    res: Response,
    options: { download?: string; info?: string } = {},
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        submitter: { select: { id: true, fullName: true, email: true } },
        report: true,
        feedbacks: {
          include: {
            author: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        group: {
          include: {
            topic: true,
            members: {
              include: {
                student: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Không tìm thấy bài nộp');
    }

    // Kiểm tra quyền truy cập
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        studentProfile: true,
        lecturerProfile: true,
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const isSubmitter = submission.submittedBy === userId;
    const isTopicOwner = submission.group?.topic?.ownerId === userId;
    const isGroupMember = submission.group?.members?.some(
      (m) => m.student?.userId === userId || (user.studentProfile && m.studentId === user.studentProfile.id),
    );
    const roleCodes = user.roles.map((r) => r.role.code);
    const isManager =
      roleCodes.includes(RoleCode.TRUONG_BO_MON) || roleCodes.includes(RoleCode.QUAN_LY_BO_MON);

    let hasAccess = isSubmitter || isTopicOwner || isGroupMember || isManager;
    if (!hasAccess && user.lecturerProfile) {
      const isReviewer = await this.prisma.reviewerAssignment.findFirst({
        where: {
          groupId: submission.groupId,
          lecturerId: user.lecturerProfile.id,
        },
      });
      if (isReviewer) hasAccess = true;
    }

    if (!hasAccess) {
      throw new BadRequestException('Bạn không có quyền truy cập bài nộp này');
    }

    // Nếu yêu cầu trả về thông tin chi tiết dạng JSON
    if (options.info === 'true' || options.download === 'false') {
      return res.json({ success: true, data: submission });
    }

    // Tải tệp tin nếu có fileUrl
    if (submission.fileUrl) {
      let resolvedPath = submission.fileUrl;
      if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.join(process.cwd(), resolvedPath);
      }
      if (fs.existsSync(resolvedPath)) {
        const downloadName = submission.fileName || path.basename(resolvedPath);
        return res.download(resolvedPath, downloadName);
      }
    }

    // Nếu không có file nhưng có sourceUrl (link github / drive / demo)
    if (submission.sourceUrl) {
      return res.redirect(submission.sourceUrl);
    }

    throw new NotFoundException('Bài nộp không có tệp đính kèm hoặc tệp không tồn tại trên hệ thống');
  }

  async feedback(userId: string, submissionId: string, content: string, yeuCauChinhSua?: boolean) {
    if (!content?.trim()) throw new BadRequestException('Nội dung phản hồi không được trống');

    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        group: {
          include: {
            topic: true,
            members: { include: { student: { include: { user: true } } } },
          },
        },
        submitter: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!submission) throw new NotFoundException('Không tìm thấy bài nộp');

    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    });

    const createdFeedback = await this.prisma.feedback.create({
      data: { submissionId, authorId: userId, content: content.trim() },
      include: { author: { select: { id: true, fullName: true, email: true } } },
    });

    // Cập nhật trạng thái bài nộp (Đánh dấu đã xem)
    let nextStatus: SubmissionStatus = submission.status;
    if (yeuCauChinhSua === true) {
      nextStatus = SubmissionStatus.REVISION_REQUIRED;
    } else if (yeuCauChinhSua === false) {
      nextStatus = SubmissionStatus.ACCEPTED;
    } else if (submission.status === SubmissionStatus.CHUA_XEM) {
      nextStatus = SubmissionStatus.UNDER_REVIEW;
    }

    if (nextStatus !== submission.status) {
      await this.prisma.submission.update({
        where: { id: submissionId },
        data: { status: nextStatus },
      });
    }

    const topicTitle = submission.group?.topic?.title || submission.group?.name || 'Đề tài KLTN';
    const lecturerName = author?.fullName || 'Giảng viên';
    const submissionTitle = submission.fileName || submission.type || 'Bài nộp';

    let notifTitle = 'Phản hồi mới từ Giảng viên';
    let notifContent = `Giảng viên ${lecturerName} đã gửi nhận xét cho bài nộp "${submissionTitle}" của đề tài "${topicTitle}": "${content.trim()}"`;

    if (yeuCauChinhSua === true) {
      notifTitle = 'Yêu cầu chỉnh sửa bài nộp KLTN';
      notifContent = `Giảng viên ${lecturerName} yêu cầu chỉnh sửa bài nộp "${submissionTitle}" của đề tài "${topicTitle}": "${content.trim()}". Vui lòng cập nhật và nộp lại phiên bản mới.`;
    } else if (yeuCauChinhSua === false) {
      notifTitle = 'Bài nộp KLTN đã được duyệt';
      notifContent = `Giảng viên ${lecturerName} đã duyệt bài nộp "${submissionTitle}" của đề tài "${topicTitle}": "${content.trim()}"`;
    }

    // 1. Gửi thông báo đến sinh viên trực tiếp nộp bài
    if (submission.submittedBy) {
      await this.notifications.create({
        userId: submission.submittedBy,
        title: notifTitle,
        content: notifContent,
        type: 'FEEDBACK',
        data: {
          submissionId,
          feedbackId: createdFeedback.id,
          groupId: submission.groupId,
          topicTitle,
          yeuCauChinhSua,
          status: nextStatus,
        },
        sendEmail: true,
      });
    }

    // 2. Gửi thông báo cho các thành viên còn lại trong nhóm (nếu có)
    const otherMembers = (submission.group?.members ?? []).filter(
      (m) => m.student?.user?.id && m.student.user.id !== submission.submittedBy,
    );
    for (const member of otherMembers) {
      if (member.student?.user?.id) {
        await this.notifications.create({
          userId: member.student.user.id,
          title: `${notifTitle} (Nhóm)`,
          content: `Nhóm bạn nhận được phản hồi từ GV ${lecturerName} cho bài nộp "${submissionTitle}": "${content.trim()}"`,
          type: 'FEEDBACK',
          data: {
            submissionId,
            feedbackId: createdFeedback.id,
            groupId: submission.groupId,
            topicTitle,
            yeuCauChinhSua,
            status: nextStatus,
          },
          sendEmail: false,
        });
      }
    }

    return {
      ...createdFeedback,
      submissionStatus: nextStatus,
    };
  }
}

