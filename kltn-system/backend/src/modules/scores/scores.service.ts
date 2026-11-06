import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ScoreDto } from './dto/score.dto';
import { ScoreChangeDto } from './dto/score-change.dto';
import { SubmitBatchScoresDto } from './dto/submit-batch-scores.dto';
import { ScoreUnlockRequestDto } from './dto/score-unlock-request.dto';
import { ApproveScoreUnlockDto } from './dto/approve-score-unlock.dto';
import { RejectScoreUnlockDto } from './dto/reject-score-unlock.dto';
import { QueryScoresDto } from './dto/query-scores.dto';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

export const DEFAULT_TEN_CRITERIA = [
  {
    code: 'TC01',
    name: 'Phân tích vấn đề và mô hình hóa được yêu cầu của đề tài.',
    weight: 10,
    maxScore: 10,
    description: 'LO 01: Phân tích vấn đề thực tế và mô hình hóa đầy đủ các yêu cầu của đề tài.',
  },
  {
    code: 'TC02',
    name: 'Áp dụng các nguyên tắc, phương pháp chuyên môn để xác định được giải pháp cho đề tài.',
    weight: 10,
    maxScore: 10,
    description: 'LO 02: Vận dụng cơ sở lý thuyết, nguyên tắc và phương pháp chuyên ngành để đề xuất giải pháp phù hợp.',
  },
  {
    code: 'TC03',
    name: 'Thiết kế được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.',
    weight: 10,
    maxScore: 10,
    description: 'LO 03: Thiết kế kiến trúc hệ thống, cơ sở dữ liệu hoặc quy trình nghiệp vụ đáp ứng yêu cầu.',
  },
  {
    code: 'TC04',
    name: 'Hiện thực được một hệ thống hoặc quy trình đáp ứng được yêu cầu của đề tài.',
    weight: 10,
    maxScore: 10,
    description: 'LO 04: Xây dựng, lập trình và hoàn thiện hệ thống hoặc quy trình theo đúng thiết kế.',
  },
  {
    code: 'TC05',
    name: 'Đánh giá được một hệ thống, quy trình đáp ứng yêu cầu của đề tài.',
    weight: 10,
    maxScore: 10,
    description: 'LO 05: Kiểm thử, thực nghiệm và đánh giá mức độ đáp ứng yêu cầu của hệ thống/quy trình.',
  },
  {
    code: 'TC06',
    name: 'Thuyết trình hiệu quả trong các lĩnh vực chuyên môn của đề tài.',
    weight: 10,
    maxScore: 10,
    description: 'LO 06: Trình bày rõ ràng, tự tin, hiệu quả nội dung chuyên môn và trả lời câu hỏi phản biện.',
  },
  {
    code: 'TC07',
    name: 'Thu thập yêu cầu từ các bên liên quan bằng các kỹ thuật phù hợp.',
    weight: 10,
    maxScore: 10,
    description: 'LO 07: Khảo sát, phỏng vấn và thu thập yêu cầu từ các bên liên quan bằng kỹ thuật phù hợp.',
  },
  {
    code: 'TC08',
    name: 'Viết được báo cáo khóa luận tốt nghiệp.',
    weight: 10,
    maxScore: 10,
    description: 'LO 08: Soạn thảo quyển báo cáo khóa luận tốt nghiệp đúng chuẩn quy cách, mạch lạc và khoa học.',
  },
  {
    code: 'TC09',
    name: 'Chứng tỏ được khả năng làm việc hiệu quả với các thành viên trong nhóm và phối hợp với các bên liên quan.',
    weight: 10,
    maxScore: 10,
    description: 'LO 09: Phối hợp làm việc nhóm hiệu quả và trao đổi tích cực với GVHD cùng các bên liên quan.',
  },
  {
    code: 'TC10',
    name: 'Khả năng hỗ trợ triển khai và vận hành hệ thống thông tin.',
    weight: 10,
    maxScore: 10,
    description: 'LO 10: Đóng gói, hướng dẫn cài đặt, hỗ trợ triển khai và vận hành hệ thống thông tin.',
  },
];

function scoreToWords(score: number): string {
  const rounded = Number(score.toFixed(2));
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 100);

  const numWords = ['Không', 'Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười'];
  let text = numWords[integerPart] || String(integerPart);

  if (decimalPart > 0) {
    const tens = Math.floor(decimalPart / 10);
    const units = decimalPart % 10;
    if (units === 0) {
      text += ` phẩy ${numWords[tens]?.toLowerCase() || tens}`;
    } else {
      text += ` phẩy ${numWords[tens]?.toLowerCase() || tens} mươi ${numWords[units]?.toLowerCase() || units}`;
    }
  }

  return text;
}

function getRatingClassification(score: number): string {
  if (score >= 9.0) return 'Xuất sắc';
  if (score >= 8.0) return 'Giỏi';
  if (score >= 6.5) return 'Khá';
  if (score >= 5.0) return 'Trung bình';
  return 'Không đạt';
}

function stripVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export interface ParsedScoreNote {
  note: string;
  studentScores: Record<string, number>;
}

export function parseScoreNote(rawNote?: string | null): ParsedScoreNote {
  if (!rawNote) return { note: '', studentScores: {} };
  const trimmed = rawNote.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (
        parsed &&
        typeof parsed === 'object' &&
        ('studentScores' in parsed || '__perStudent' in parsed)
      ) {
        return {
          note: typeof parsed.note === 'string' ? parsed.note : '',
          studentScores:
            parsed.studentScores && typeof parsed.studentScores === 'object'
              ? parsed.studentScores
              : {},
        };
      }
    } catch {
      // fall through to plain text
    }
  }
  return { note: rawNote, studentScores: {} };
}

export function serializeScoreNote(
  note?: string | null,
  studentScores?: Record<string, number> | null,
): string | null {
  const cleanNote = note ? String(note).trim() : '';
  if (studentScores && Object.keys(studentScores).length > 0) {
    return JSON.stringify({
      __perStudent: true,
      note: cleanNote,
      studentScores,
    });
  }
  return cleanNote || null;
}

export function resolveStudentCriterionScore(
  scoreRow: { value: any; note?: string | null },
  studentKeys: Array<string | undefined | null>,
): number {
  const { studentScores } = parseScoreNote(scoreRow.note);
  for (const key of studentKeys) {
    if (
      key &&
      studentScores[key] !== undefined &&
      studentScores[key] !== null &&
      !isNaN(Number(studentScores[key]))
    ) {
      return Number(studentScores[key]);
    }
  }
  return Number(scoreRow.value) || 0;
}

export function calculateStudentWeightedTotal(
  scores: Array<{ value: any; note?: string | null }>,
  studentKeys: Array<string | undefined | null>,
): number {
  if (!scores || scores.length === 0) return 0;
  const total = scores.reduce(
    (sum, score) => sum + resolveStudentCriterionScore(score, studentKeys),
    0,
  );
  return Number((total / scores.length).toFixed(2));
}

export function parseAllowedUntil(thoiHan?: string | number | Date): Date {
  const defaultHours = 24;
  if (!thoiHan) {
    return new Date(Date.now() + defaultHours * 60 * 60 * 1000);
  }
  if (typeof thoiHan === 'number') {
    return new Date(Date.now() + thoiHan * 60 * 60 * 1000);
  }
  if (thoiHan instanceof Date) {
    return thoiHan;
  }
  const str = String(thoiHan).trim();
  const asNum = Number(str);
  if (!isNaN(asNum) && asNum > 0 && !str.includes('-') && !str.includes(':') && !str.includes('T')) {
    return new Date(Date.now() + asNum * 60 * 60 * 1000);
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return new Date(Date.now() + defaultHours * 60 * 60 * 1000);
}

@Injectable()
export class ScoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Tự động khởi tạo / đồng bộ 10 tiêu chí chuẩn KLTN
   */
  async ensureTenCriteria() {
    await this.prisma.scoreCriterion.updateMany({
      where: { code: { in: ['CONTENT', 'IMPLEMENTATION', 'PRESENTATION'] } },
      data: { active: false },
    });

    for (const tc of DEFAULT_TEN_CRITERIA) {
      await this.prisma.scoreCriterion.upsert({
        where: { code: tc.code },
        update: {
          name: tc.name,
          weight: tc.weight,
          maxScore: tc.maxScore,
          description: tc.description,
          active: true,
        },
        create: {
          code: tc.code,
          name: tc.name,
          weight: tc.weight,
          maxScore: tc.maxScore,
          description: tc.description,
          active: true,
        },
      });
    }
  }

  async criteria() {
    await this.ensureTenCriteria();
    return this.prisma.scoreCriterion.findMany({
      where: { active: true, code: { startsWith: 'TC' } },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Lấy cấu trúc form chấm điểm theo đề tài (10 tiêu chí + điểm đã nhập + trạng thái khóa)
   */
  async getScoringForm(userId: string, topicIdOrGroupId: string, requestedRole?: string) {
    await this.ensureTenCriteria();

    // 1. Tìm Topic và Group
    let topic: any = await this.prisma.topic.findFirst({
      where: {
        OR: [{ id: topicIdOrGroupId }, { groups: { some: { id: topicIdOrGroupId } } }],
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        reviewer: { select: { id: true, fullName: true, email: true } },
        groups: {
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
        },
      },
    });

    let group: any = topic?.groups?.[0];

    // Fallback: nếu truyền thẳng groupId
    if (!group) {
      group = await this.prisma.group.findUnique({
        where: { id: topicIdOrGroupId },
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
          topic: {
            include: {
              owner: { select: { id: true, fullName: true, email: true } },
              reviewer: { select: { id: true, fullName: true, email: true } },
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
      } as any);

      if (group?.topic) {
        topic = group.topic as any;
      }
    }

    if (!topic && !group) {
      throw new NotFoundException(`Không tìm thấy đề tài hoặc nhóm với mã: ${topicIdOrGroupId}`);
    }

    // 2. Xác định vai trò của người chấm
    let role = requestedRole || 'HUONG_DAN';
    if (!requestedRole && topic) {
      if (topic.ownerId === userId) {
        role = 'HUONG_DAN';
      } else if (
        topic.reviewerId === userId ||
        group?.reviewerAssignments?.some((ra: any) => ra.lecturer?.user?.id === userId)
      ) {
        role = 'PHAN_BIEN';
      } else if (
        group?.defenses?.some((d: any) =>
          d.committee?.members?.some((m: any) => m.user?.id === userId),
        )
      ) {
        role = 'HOI_DONG';
      }
    }

    // 3. Lấy 10 tiêu chí chuẩn (TC01 - TC10)
    const criteriaList = await this.prisma.scoreCriterion.findMany({
      where: { active: true, code: { startsWith: 'TC' } },
      orderBy: { code: 'asc' },
    });

    // 4. Lấy điểm hiện tại của người dùng này cho nhóm
    const existingScores = group
      ? await this.prisma.score.findMany({
          where: { groupId: group.id, scorerId: userId },
          include: { criterion: true },
        })
      : [];

    // Kiểm tra trạng thái khóa điểm & thời hạn mở khóa
    const now = new Date();
    // Tự động chuyển các điểm OPENED quá hạn về LOCKED
    const hasExpiredOpened = existingScores.some(
      (s) => s.status === 'OPENED' && s.unlockedUntil && s.unlockedUntil < now,
    );
    if (hasExpiredOpened && group?.id) {
      await this.prisma.score.updateMany({
        where: {
          groupId: group.id,
          scorerId: userId,
          status: 'OPENED',
          unlockedUntil: { lt: now },
        },
        data: { status: 'LOCKED' },
      });
      for (const s of existingScores) {
        if (s.status === 'OPENED' && s.unlockedUntil && s.unlockedUntil < now) {
          s.status = 'LOCKED';
        }
      }
    }

    const midtermStatus = group?.midtermStatus ?? 'PENDING';
    const isMidtermPassed = midtermStatus === 'CONTINUE';

    const hasScores = existingScores.length > 0;
    const isOpened = existingScores.some((s) => s.status === 'OPENED' && (!s.unlockedUntil || s.unlockedUntil >= now));
    const isLocked = hasScores && !isOpened && existingScores.some((s) => s.status === 'LOCKED' || s.status === 'SUBMITTED');
    const isDraft = !hasScores || existingScores.some((s) => s.status === 'DRAFT');
    const canEdit = isMidtermPassed && (!isLocked || isOpened || isDraft);

    // Tính điểm tổng theo trọng số
    const totalScore = this.calculateWeightedTotal(existingScores);

    // Kiểm tra yêu cầu mở khóa đang chờ duyệt hoặc gần nhất (nếu có)
    const unlockRequest = group
      ? await this.prisma.scoreChangeRequest.findFirst({
          where: { groupId: group.id, requesterId: userId },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    // Danh sách sinh viên thực hiện (chấm riêng cho từng sinh viên)
    const students =
      group?.members?.map((m: any, idx: number) => ({
        id: m.student?.user?.id || m.studentId,
        studentId: m.studentId,
        userId: m.student?.user?.id,
        studentCode: m.student?.studentCode || `SV${idx + 1}`,
        fullName: m.student?.user?.fullName || `Sinh viên ${idx + 1}`,
        email: m.student?.user?.email,
        isLeader: m.isLeader,
      })) ?? [];

    const studentTotals = students.map((st: any) => {
      const stTotal = hasScores
        ? calculateStudentWeightedTotal(existingScores, [
            st.id,
            st.studentId,
            st.userId,
            st.studentCode,
          ])
        : 0;
      return {
        id: st.id,
        studentId: st.studentId,
        userId: st.userId,
        studentCode: st.studentCode,
        fullName: st.fullName,
        isLeader: st.isLeader,
        totalScore: stTotal,
        rating: getRatingClassification(stTotal),
        result: stTotal >= 5.0 ? 'DAT' : 'KHONG_DAT',
      };
    });

    return {
      topic: {
        id: topic?.id ?? group?.topicId,
        title: topic?.title ?? group?.name ?? 'Đề tài Khóa luận',
        owner: topic?.owner,
        group: group
          ? {
              id: group.id,
              code: group.code,
              name: group.name,
              midtermStatus: group.midtermStatus,
              midtermNote: group.midtermNote,
              midtermAt: group.midtermAt,
            }
          : null,
        students,
      },
      role,
      midtermStatus,
      isMidtermPassed,
      criteria: criteriaList.map((c, index) => ({
        id: c.id,
        order: index + 1,
        code: c.code,
        name: c.name,
        description: c.description,
        weight: Number(c.weight),
        maxScore: Number(c.maxScore),
      })),
      existingScores: existingScores.map((s) => {
        const parsed = parseScoreNote(s.note);
        const resolvedStudentScores: Record<string, number> = { ...parsed.studentScores };
        for (const st of students) {
          const val = resolveStudentCriterionScore(s, [
            st.id,
            st.studentId,
            st.userId,
            st.studentCode,
          ]);
          if (st.id) resolvedStudentScores[st.id] = val;
          if (st.studentId) resolvedStudentScores[st.studentId] = val;
          if (st.userId) resolvedStudentScores[st.userId] = val;
          if (st.studentCode) resolvedStudentScores[st.studentCode] = val;
        }
        return {
          id: s.id,
          criterionId: s.criterionId,
          criterionCode: s.criterion.code,
          criterionName: s.criterion.name,
          value: Number(s.value),
          note: parsed.note,
          studentScores: resolvedStudentScores,
          status: s.status,
          unlockedUntil: s.unlockedUntil,
        };
      }),
      studentTotals,
      totalScore,
      rating: getRatingClassification(totalScore),
      isDraft,
      isLocked,
      canEdit,
      unlockRequest: unlockRequest
        ? {
            id: unlockRequest.id,
            reason: unlockRequest.reason,
            status: unlockRequest.status,
            createdAt: unlockRequest.createdAt,
            reviewedAt: unlockRequest.reviewedAt,
            expiresAt: unlockRequest.expiresAt,
            rejectReason: unlockRequest.rejectReason,
            isExpired: unlockRequest.expiresAt ? unlockRequest.expiresAt < now : false,
          }
        : null,
      formula: 'avg(scores) = sum(score_i) / n',
    };
  }

  /**
   * Tính điểm tổng (Trung bình cộng các tiêu chí đã chấm)
   */
  calculateWeightedTotal(scores: Array<{ value: any; criterion?: { weight: any } }>): number {
    if (!scores || scores.length === 0) return 0;
    const total = scores.reduce((sum, score) => sum + (Number(score.value) || 0), 0);
    return Number((total / scores.length).toFixed(2));
  }

  /**
   * Lọc danh sách điểm ưu tiên 10 tiêu chí chuẩn (TC01-TC10) để tránh tính trùng tiêu chí cũ
   */
  getScoresToCalculate(scores: Array<any>): Array<any> {
    if (!scores || scores.length === 0) return [];
    const tcScores = scores.filter((s) => s.criterion?.code?.startsWith('TC'));
    return tcScores.length > 0 ? tcScores : scores;
  }

  /**
   * Nhập điểm chi tiết 10 tiêu chí (Batch Scoring)
   */
  async submitBatchScores(userId: string, dto: SubmitBatchScoresDto) {
    await this.ensureTenCriteria();

    // 1. Xác định nhóm từ topicId hoặc groupId
    let groupId = dto.groupId;
    let topicId = dto.topicId;

    if (!groupId && topicId) {
      const topic = await this.prisma.topic.findFirst({
        where: { OR: [{ id: topicId }, { groups: { some: { id: topicId } } }] },
        include: { groups: true },
      });
      if (topic?.groups && topic.groups.length > 0) {
        groupId = topic.groups[0].id;
      }
    }

    if (!groupId && !topicId) {
      throw new BadRequestException('Vui lòng cung cấp topicId hoặc groupId để nhập điểm.');
    }

    // Nếu vẫn chưa có groupId, tìm nhóm đang active của đề tài
    if (!groupId) {
      const group = await this.prisma.group.findFirst({
        where: { topicId },
      });
      if (!group) {
        throw new NotFoundException('Không tìm thấy nhóm sinh viên thực hiện đề tài này.');
      }
      groupId = group.id;
    }

    // Kiểm tra bắt buộc: Nhóm phải được GVHD xác nhận CHO LÀM TIẾP (CONTINUE) ở đánh giá giữa kỳ mới được nhập điểm
    const targetGroup = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        topic: true,
        members: {
          include: {
            student: {
              include: { user: true },
            },
          },
          orderBy: { isLeader: 'desc' },
        },
      },
    });
    if (!targetGroup) {
      throw new NotFoundException('Không tìm thấy nhóm sinh viên thực hiện đề tài này.');
    }
    if (targetGroup.midtermStatus !== 'CONTINUE') {
      if (targetGroup.midtermStatus === 'STOPPED') {
        throw new BadRequestException(
          `Nhóm ${targetGroup.code} đã dừng thực hiện đề tài ở đánh giá giữa kỳ (DỪNG ĐỀ TÀI), không thể tiến hành nhập điểm.`,
        );
      }
      throw new BadRequestException(
        `Nhóm ${targetGroup.code} chưa được GVHD xác nhận qua giữa kỳ (CHO LÀM TIẾP). Vui lòng xác nhận đánh giá giữa kỳ trước khi tiến hành nhập điểm.`,
      );
    }

    // 2. Ràng buộc khóa điểm & thời hạn mở khóa: Nếu điểm đã khóa và chưa được mở khóa thì cấm sửa
    const now = new Date();
    const existingScores = await this.prisma.score.findMany({
      where: { groupId, scorerId: userId },
    });

    // Nếu các điểm OPENED đã quá thời hạn cho phép, tự động khóa lại
    const expiredOpenedScores = existingScores.filter(
      (s) => s.status === 'OPENED' && s.unlockedUntil && s.unlockedUntil < now,
    );
    if (expiredOpenedScores.length > 0) {
      await this.prisma.score.updateMany({
        where: {
          groupId,
          scorerId: userId,
          status: 'OPENED',
          unlockedUntil: { lt: now },
        },
        data: { status: 'LOCKED' },
      });
      for (const s of existingScores) {
        if (s.status === 'OPENED' && s.unlockedUntil && s.unlockedUntil < now) {
          s.status = 'LOCKED';
        }
      }
    }

    const hasLockedScores = existingScores.some(
      (s) => s.status === 'LOCKED' || s.status === 'SUBMITTED',
    );
    const isOpened = existingScores.some(
      (s) => s.status === 'OPENED' && (!s.unlockedUntil || s.unlockedUntil >= now),
    );

    if (hasLockedScores && !isOpened) {
      throw new BadRequestException(
        expiredOpenedScores.length > 0
          ? 'Thời hạn cho phép sửa điểm đã hết. Điểm đã được tự động khóa lại. Vui lòng gửi yêu cầu mở khóa mới tới Trưởng bộ môn.'
          : 'Điểm đã được khóa. Không được tự ý sửa điểm đã khóa. Vui lòng gửi yêu cầu mở khóa tới Trưởng bộ môn.',
      );
    }

    // 3. Lấy danh mục tiêu chí
    const allCriteria = await this.prisma.scoreCriterion.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });

    const isDraft = dto.isDraft ?? false;
    const targetStatus = isDraft ? 'DRAFT' : 'LOCKED';
    const groupMembers = targetGroup.members || [];

    // 4. Lưu từng tiêu chí (hỗ trợ chấm riêng cho từng sinh viên trong nhóm)
    const updatedScores: any[] = [];

    for (const item of dto.scores) {
      // Tìm criterion tương ứng (hỗ trợ UUID, code như TC01..TC10, hoặc số 1..10)
      const num = Number(item.tieuChiId);
      const tcCode = !isNaN(num) && num >= 1 && num <= 10 ? `TC${String(num).padStart(2, '0')}` : null;

      const criterion = allCriteria.find(
        (c) =>
          c.id === item.tieuChiId ||
          c.code.toLowerCase() === String(item.tieuChiId).toLowerCase() ||
          (tcCode && c.code.toUpperCase() === tcCode) ||
          (tcCode && c.code.toUpperCase() === `TC${num}`),
      );

      if (!criterion) continue;

      const maxVal = Number(criterion.maxScore) || 10;
      const clampScore = (v: any) => Math.min(Math.max(Number(v) || 0, 0), maxVal);

      const studentScoresMap: Record<string, number> = {};
      const memberScoreValues: number[] = [];

      if (item.studentScores && typeof item.studentScores === 'object' && Object.keys(item.studentScores).length > 0) {
        // Lưu toàn bộ key do client gửi lên
        for (const [k, v] of Object.entries(item.studentScores)) {
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            studentScoresMap[k] = Number(clampScore(v).toFixed(2));
          }
        }
        // Đồng bộ tất cả định danh (userId, studentId, studentCode) cho từng thành viên trong nhóm
        for (const m of groupMembers) {
          const uId = m.student?.user?.id;
          const sId = m.studentId;
          const sCode = m.student?.studentCode;
          const matchedVal =
            (uId && studentScoresMap[uId] !== undefined ? studentScoresMap[uId] : undefined) ??
            (sId && studentScoresMap[sId] !== undefined ? studentScoresMap[sId] : undefined) ??
            (sCode && studentScoresMap[sCode] !== undefined ? studentScoresMap[sCode] : undefined);

          if (matchedVal !== undefined) {
            if (uId) studentScoresMap[uId] = matchedVal;
            if (sId) studentScoresMap[sId] = matchedVal;
            if (sCode) studentScoresMap[sCode] = matchedVal;
            memberScoreValues.push(matchedVal);
          }
        }
      }

      const rawVal = item.score ?? item.value ?? item.diem;
      let numVal = 0;
      if (memberScoreValues.length > 0) {
        const sumMemberScores = memberScoreValues.reduce((acc, v) => acc + v, 0);
        numVal = Number((sumMemberScores / memberScoreValues.length).toFixed(2));
      } else if (Object.keys(studentScoresMap).length > 0) {
        const vals = Object.values(studentScoresMap);
        numVal = Number((vals.reduce((acc, v) => acc + v, 0) / vals.length).toFixed(2));
      } else {
        numVal = Number(clampScore(rawVal ?? 0).toFixed(2));
        for (const m of groupMembers) {
          if (m.student?.user?.id) studentScoresMap[m.student.user.id] = numVal;
          if (m.studentId) studentScoresMap[m.studentId] = numVal;
          if (m.student?.studentCode) studentScoresMap[m.student.studentCode] = numVal;
        }
      }

      const cleanNote = item.note || dto.generalComment || '';
      const serializedNote = serializeScoreNote(cleanNote, studentScoresMap);

      const existingOne = existingScores.find((s) => s.criterionId === criterion.id);

      const saved = await this.prisma.score.upsert({
        where: {
          groupId_criterionId_scorerId: {
            groupId,
            criterionId: criterion.id,
            scorerId: userId,
          },
        },
        update: {
          value: numVal,
          note: serializedNote,
          status: targetStatus,
          history: {
            create: {
              oldValue: existingOne?.value,
              newValue: numVal,
              changedBy: userId,
              reason: cleanNote || (isDraft ? 'Cập nhật bản nháp' : 'Chấm điểm chính thức'),
            },
          },
        },
        create: {
          groupId,
          criterionId: criterion.id,
          scorerId: userId,
          value: numVal,
          note: serializedNote,
          status: targetStatus,
        },
        include: { criterion: true },
      });

      updatedScores.push(saved);
    }

    // 5. Tính điểm tổng theo từng sinh viên & điểm trung bình nhóm
    const allScorerScores = await this.prisma.score.findMany({
      where: { groupId, scorerId: userId },
      include: { criterion: true },
    });
    const tcScores = allScorerScores.filter((s) => s.criterion.code.startsWith('TC'));
    const scoresToCalculate = tcScores.length > 0 ? tcScores : allScorerScores;
    const totalScore = this.calculateWeightedTotal(scoresToCalculate);

    const studentTotals = groupMembers.map((m, idx) => {
      const uId = m.student?.user?.id;
      const sId = m.studentId;
      const sCode = m.student?.studentCode || `SV${idx + 1}`;
      const stTotal = calculateStudentWeightedTotal(scoresToCalculate, [uId, sId, sCode]);
      return {
        id: uId || sId,
        studentId: sId,
        userId: uId,
        studentCode: sCode,
        fullName: m.student?.user?.fullName || `Sinh viên ${idx + 1}`,
        isLeader: m.isLeader,
        totalScore: stTotal,
        rating: getRatingClassification(stTotal),
        result: stTotal >= 5.0 ? 'DAT' : 'KHONG_DAT',
      };
    });

    // 6. Nếu điểm chính thức (không phải nháp): thông báo riêng điểm cho từng sinh viên trong nhóm
    if (!isDraft) {
      const topicTitle = targetGroup.topic?.title || targetGroup.name;
      for (const st of studentTotals) {
        if (st.userId) {
          await this.notifications.create({
            userId: st.userId,
            title: 'Kết quả đánh giá KLTN đã được hoàn tất & khóa điểm',
            content: `Đề tài "${topicTitle}" đã được cán bộ đánh giá (${dto.role || 'Giảng viên'}) nhập điểm chính thức cho sinh viên ${st.fullName} (${st.studentCode}). Điểm trung bình: ${st.totalScore}/10 (${st.rating} - ${st.result === 'DAT' ? 'Đạt' : 'Không đạt'}).`,
            type: 'SCORE',
            data: {
              groupId,
              topicId: targetGroup.topicId,
              totalScore: st.totalScore,
              rating: st.rating,
              result: st.result,
              role: dto.role,
            },
            sendEmail: true,
          });
        }
      }
    }

    return {
      message: isDraft
        ? 'Đã lưu bản nháp điểm cho từng sinh viên thành công. Bạn có thể tiếp tục chỉnh sửa.'
        : 'Đã hoàn tất nhập điểm từng sinh viên và khóa điểm chính thức.',
      totalScore,
      rating: getRatingClassification(totalScore),
      studentTotals,
      isDraft,
      isLocked: !isDraft,
      scoresCount: updatedScores.length,
      scores: updatedScores.map((s) => {
        const parsed = parseScoreNote(s.note);
        return {
          criterionId: s.criterionId,
          criterionCode: s.criterion.code,
          name: s.criterion.name,
          weight: Number(s.criterion.weight),
          value: Number(s.value),
          note: parsed.note,
          studentScores: parsed.studentScores,
          status: s.status,
        };
      }),
    };
  }

  /**
   * Giảng viên gửi yêu cầu mở khóa điểm tới Trưởng bộ môn
   */
  async requestScoreUnlock(userId: string, dto: ScoreUnlockRequestDto) {
    let groupId = dto.groupId;

    if (!groupId && dto.topicId) {
      const group = await this.prisma.group.findFirst({
        where: { OR: [{ id: dto.topicId }, { topicId: dto.topicId }] },
      });
      groupId = group?.id;
    }

    if (!groupId) {
      throw new BadRequestException('Không xác định được nhóm đề tài cần mở khóa điểm.');
    }

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { topic: true },
    });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm đề tài');
    if (group.midtermStatus !== 'CONTINUE') {
      throw new BadRequestException(
        group.midtermStatus === 'STOPPED'
          ? 'Nhóm đã dừng thực hiện đề tài ở giữa kỳ, không thể yêu cầu mở khóa điểm.'
          : 'Nhóm chưa được GVHD xác nhận qua giữa kỳ (CHO LÀM TIẾP), chưa mở giai đoạn chấm điểm.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Tạo yêu cầu mở khóa
    const request = await this.prisma.scoreChangeRequest.create({
      data: {
        requesterId: userId,
        groupId,
        reason: dto.reason,
        status: 'PENDING',
      },
    });

    // Gửi thông báo đến Trưởng bộ môn / Quản lý bộ môn
    const hodUsers = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              code: { in: ['TRUONG_BO_MON', 'QUAN_LY_BO_MON'] },
            },
          },
        },
      },
    });

    const topicTitle = group.topic?.title || group.name;
    for (const hod of hodUsers) {
      await this.notifications.create({
        userId: hod.id,
        title: 'Yêu cầu mở khóa chỉnh sửa điểm KLTN',
        content: `Giảng viên ${user?.fullName ?? ''} đã gửi yêu cầu mở khóa điểm cho đề tài "${topicTitle}". Lý do: ${dto.reason}`,
        type: 'SCORE',
        data: {
          requestId: request.id,
          groupId,
          requesterId: userId,
        },
      });
    }

    return {
      message: 'Đã gửi yêu cầu mở khóa điểm tới Trưởng bộ môn thành công.',
      request,
    };
  }

  async groupScores(groupId: string) {
    await this.ensureTenCriteria();
    const scores = await this.prisma.score.findMany({
      where: { groupId },
      include: { criterion: true, scorer: { select: { fullName: true } } },
    });
    const weighted = scores.reduce(
      (sum, score) => sum + (Number(score.value) * Number(score.criterion.weight)) / 100,
      0,
    );

    // Tính điểm thưởng NCKH đã được duyệt của sinh viên trong nhóm
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { include: { student: { include: { user: true } } } } },
    });
    const userIds = (group?.members?.map((m) => m.student?.user?.id).filter(Boolean) as string[]) ?? [];
    const approvedEvidences =
      userIds.length > 0
        ? await this.prisma.evidence.findMany({
            where: { userId: { in: userIds }, status: 'APPROVED' },
          })
        : [];
    const rawBonus = approvedEvidences.reduce((sum, ev) => sum + (ev.points ? Number(ev.points) : 0), 0);
    const bonusPoints = Math.min(2.0, Number(rawBonus.toFixed(2)));
    const total = Math.min(10, Number((weighted + bonusPoints).toFixed(2)));

    return {
      scores,
      weightedScore: Number(weighted.toFixed(2)),
      bonusPoints,
      total,
      approvedEvidences,
    };
  }

  async upsert(userId: string, dto: ScoreDto) {
    const criterion = await this.prisma.scoreCriterion.findUnique({ where: { id: dto.criterionId } });
    if (!criterion) throw new NotFoundException('Không tìm thấy tiêu chí');

    const targetGroup = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      select: { id: true, code: true, midtermStatus: true },
    });
    if (!targetGroup) throw new NotFoundException('Không tìm thấy nhóm đề tài');
    if (targetGroup.midtermStatus !== 'CONTINUE') {
      throw new BadRequestException(
        targetGroup.midtermStatus === 'STOPPED'
          ? `Nhóm ${targetGroup.code} đã dừng đề tài ở giữa kỳ, không thể nhập điểm.`
          : `Nhóm ${targetGroup.code} chưa được GVHD xác nhận qua giữa kỳ (CHO LÀM TIẾP). Vui lòng xác nhận giữa kỳ trước khi nhập điểm.`,
      );
    }

    const existing = await this.prisma.score.findUnique({
      where: {
        groupId_criterionId_scorerId: {
          groupId: dto.groupId,
          criterionId: dto.criterionId,
          scorerId: userId,
        },
      },
    });
    if (existing?.status === 'LOCKED') {
      throw new BadRequestException('Điểm đã khóa. Không được tự ý sửa điểm đã khóa. Vui lòng gửi yêu cầu mở khóa.');
    }
    if (existing?.status === 'OPENED' && existing.unlockedUntil && existing.unlockedUntil < new Date()) {
      await this.prisma.score.update({ where: { id: existing.id }, data: { status: 'LOCKED' } });
      throw new BadRequestException('Thời hạn cho phép sửa điểm đã hết. Điểm đã được khóa lại. Vui lòng gửi yêu cầu mở khóa mới.');
    }

    const score = await this.prisma.score.upsert({
      where: {
        groupId_criterionId_scorerId: {
          groupId: dto.groupId,
          criterionId: dto.criterionId,
          scorerId: userId,
        },
      },
      update: {
        value: dto.value,
        note: dto.note,
        status: 'SUBMITTED',
        history: {
          create: {
            oldValue: existing?.value,
            newValue: dto.value,
            changedBy: userId,
            reason: dto.note,
          },
        },
      },
      create: {
        groupId: dto.groupId,
        criterionId: dto.criterionId,
        scorerId: userId,
        value: dto.value,
        note: dto.note,
        status: 'SUBMITTED',
      },
    });

    // Gửi thông báo loại SCORE tới sinh viên trong nhóm
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      include: {
        topic: true,
        members: { include: { student: { include: { user: true } } } },
      },
    });

    if (group?.members) {
      const topicTitle = group.topic?.title || group.name;
      for (const member of group.members) {
        const studentUserId = member.student?.user?.id;
        if (studentUserId) {
          await this.notifications.create({
            userId: studentUserId,
            title: 'Điểm KLTN đã được công bố / cập nhật',
            content: `Điểm số cho tiêu chí "${criterion.name}" của đề tài "${topicTitle}" đã được công bố: ${dto.value}/${criterion.maxScore} điểm.`,
            type: 'SCORE',
            data: {
              groupId: dto.groupId,
              criterionId: dto.criterionId,
              criterionName: criterion.name,
              value: dto.value,
            },
            sendEmail: true,
          });
        }
      }
    }

    return score;
  }

  requestChange(userId: string, dto: ScoreChangeDto) {
    return this.requestScoreUnlock(userId, { groupId: dto.groupId, reason: dto.reason });
  }

  requests(status?: string) {
    const normalizedStatus = status ? (status.toUpperCase() as any) : undefined;
    return this.prisma.scoreChangeRequest.findMany({
      where: normalizedStatus ? { status: normalizedStatus } : undefined,
      include: {
        group: { include: { topic: { include: { owner: { select: { id: true, fullName: true, email: true } } } } } },
        requester: { select: { id: true, fullName: true, email: true } },
        reviewer: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveUnlockRequest(
    reviewerId: string,
    id: string,
    dto?: ApproveScoreUnlockDto,
    reqInfo?: { ip?: string; userAgent?: string },
  ) {
    const request = await this.prisma.scoreChangeRequest.findUnique({
      where: { id },
      include: {
        group: { include: { topic: true } },
        requester: true,
      },
    });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu mở khóa điểm');
    if (request.status !== 'PENDING' && request.status !== 'APPROVED') {
      throw new BadRequestException(`Yêu cầu này đã được xử lý trước đó với trạng thái: ${request.status}`);
    }

    const expiresAt = parseAllowedUntil(dto?.thoiHanChoPhepSua);

    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái yêu cầu
      const updatedRequest = await tx.scoreChangeRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          expiresAt,
        },
      });

      // 2. Mở khóa điểm cho nhóm và giảng viên yêu cầu
      let updatedScores = await tx.score.updateMany({
        where: {
          groupId: request.groupId,
          scorerId: request.requesterId,
          status: { in: ['LOCKED', 'SUBMITTED', 'OPENED'] },
        },
        data: {
          status: 'OPENED',
          unlockedUntil: expiresAt,
        },
      });

      // Nếu không có điểm nào ứng với scorerId, mở các điểm LOCKED chung trong nhóm
      if (updatedScores.count === 0) {
        updatedScores = await tx.score.updateMany({
          where: {
            groupId: request.groupId,
            status: { in: ['LOCKED', 'SUBMITTED', 'OPENED'] },
          },
          data: {
            status: 'OPENED',
            unlockedUntil: expiresAt,
          },
        });
      }

      // 3. Ghi Audit Log đầy đủ
      const topicTitle = request.group?.topic?.title || request.group?.name || 'Đề tài';
      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'APPROVE_SCORE_UNLOCK',
          entity: 'ScoreChangeRequest',
          entityId: id,
          metadata: {
            requestId: id,
            groupId: request.groupId,
            topicId: request.group?.topicId,
            topicTitle,
            requesterId: request.requesterId,
            requesterName: request.requester?.fullName,
            reason: request.reason,
            thoiHanChoPhepSua: dto?.thoiHanChoPhepSua ?? null,
            expiresAt: expiresAt.toISOString(),
            unlockedScoresCount: updatedScores.count,
            approvedAt: new Date().toISOString(),
          },
          ipAddress: reqInfo?.ip,
          userAgent: reqInfo?.userAgent,
        },
      });

      // 4. Gửi thông báo đến giảng viên đã gửi yêu cầu
      const formattedDeadline = expiresAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      await this.notifications.create({
        userId: request.requesterId,
        title: 'Yêu cầu mở khóa điểm đã được DUYỆT',
        content: `Trưởng bộ môn đã duyệt yêu cầu mở khóa điểm cho đề tài "${topicTitle}". Thời hạn cho phép sửa điểm đến: ${formattedDeadline}. Bạn có thể cập nhật lại điểm ngay bây giờ.`,
        type: 'SCORE',
        data: {
          requestId: id,
          groupId: request.groupId,
          status: 'APPROVED',
          expiresAt: expiresAt.toISOString(),
        },
        sendEmail: true,
      });

      return {
        message: 'Đã phê duyệt yêu cầu mở khóa điểm thành công.',
        request: updatedRequest,
        expiresAt,
      };
    });
  }

  async rejectUnlockRequest(
    reviewerId: string,
    id: string,
    dto: RejectScoreUnlockDto,
    reqInfo?: { ip?: string; userAgent?: string },
  ) {
    if (!dto?.lyDo?.trim()) {
      throw new BadRequestException('Vui lòng cung cấp lý do từ chối yêu cầu.');
    }

    const request = await this.prisma.scoreChangeRequest.findUnique({
      where: { id },
      include: {
        group: { include: { topic: true } },
        requester: true,
      },
    });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu mở khóa điểm');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Yêu cầu này đã được xử lý trước đó với trạng thái: ${request.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái yêu cầu
      const updatedRequest = await tx.scoreChangeRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          rejectReason: dto.lyDo.trim(),
        },
      });

      // 2. Ghi Audit Log đầy đủ
      const topicTitle = request.group?.topic?.title || request.group?.name || 'Đề tài';
      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'REJECT_SCORE_UNLOCK',
          entity: 'ScoreChangeRequest',
          entityId: id,
          metadata: {
            requestId: id,
            groupId: request.groupId,
            topicId: request.group?.topicId,
            topicTitle,
            requesterId: request.requesterId,
            requesterName: request.requester?.fullName,
            reason: request.reason,
            rejectReason: dto.lyDo.trim(),
            rejectedAt: new Date().toISOString(),
          },
          ipAddress: reqInfo?.ip,
          userAgent: reqInfo?.userAgent,
        },
      });

      // 3. Gửi thông báo đến giảng viên
      await this.notifications.create({
        userId: request.requesterId,
        title: 'Yêu cầu mở khóa điểm bị TỪ CHỐI',
        content: `Trưởng bộ môn đã từ chối yêu cầu mở khóa điểm cho đề tài "${topicTitle}". Lý do: ${dto.lyDo.trim()}`,
        type: 'SCORE',
        data: {
          requestId: id,
          groupId: request.groupId,
          status: 'REJECTED',
          rejectReason: dto.lyDo.trim(),
        },
        sendEmail: true,
      });

      return {
        message: 'Đã từ chối yêu cầu mở khóa điểm.',
        request: updatedRequest,
      };
    });
  }

  async reviewChange(userId: string, id: string, approved: boolean, thoiHanChoPhepSua?: any, lyDo?: string) {
    if (approved) {
      const res = await this.approveUnlockRequest(userId, id, { thoiHanChoPhepSua });
      return res.request;
    } else {
      const res = await this.rejectUnlockRequest(userId, id, { lyDo: lyDo || 'Trưởng bộ môn từ chối yêu cầu mở khóa' });
      return res.request;
    }
  }

  async unlock(groupId: string, hours?: number, reason?: string, reviewerId?: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, code: true, midtermStatus: true },
    });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm đề tài');
    if (group.midtermStatus !== 'CONTINUE') {
      throw new BadRequestException(
        group.midtermStatus === 'STOPPED'
          ? `Nhóm ${group.code} đã dừng đề tài ở giữa kỳ, không thể mở khóa điểm.`
          : `Nhóm ${group.code} chưa được GVHD xác nhận qua giữa kỳ (CHO LÀM TIẾP), chưa mở giai đoạn nhập điểm.`,
      );
    }

    const expiresAt = hours && hours > 0
      ? new Date(Date.now() + hours * 3600 * 1000)
      : new Date(Date.now() + 24 * 3600 * 1000); // Mặc định 24h

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.score.updateMany({
        where: { groupId, status: { in: ['LOCKED', 'SUBMITTED', 'OPENED'] } },
        data: {
          status: 'OPENED',
          unlockedUntil: expiresAt,
        },
      });

      // Nếu có yêu cầu mở khóa PENDING nào cho nhóm này, cũng tự động APPROVE luôn
      await tx.scoreChangeRequest.updateMany({
        where: { groupId, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          expiresAt,
        },
      });

      return {
        message: 'Đã mở khóa điểm thành công',
        unlockedCount: updated.count,
        expiresAt,
      };
    });
  }

  async lock(groupId: string) {
    const updated = await this.prisma.score.updateMany({
      where: { groupId, status: 'OPENED' },
      data: {
        status: 'LOCKED',
        unlockedUntil: null,
      },
    });
    return {
      message: 'Đã khóa điểm thành công',
      lockedCount: updated.count,
    };
  }

  /**
   * Xuất PDF biểu mẫu đánh giá KLTN 10 tiêu chí đúng mẫu chuẩn để in ký
   */
  async exportPdf(topicIdOrGroupId: string, role?: string, scorerId?: string): Promise<Buffer> {
    await this.ensureTenCriteria();

    // Tìm nhóm và đề tài
    let group = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: topicIdOrGroupId }, { topicId: topicIdOrGroupId }],
      },
      include: {
        topic: {
          include: {
            owner: true,
          },
        },
        members: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Không tìm thấy đề tài hoặc nhóm với mã: ${topicIdOrGroupId}`);
    }

    // Lấy 10 tiêu chí
    const allCriteria = await this.prisma.scoreCriterion.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });

    // Lấy điểm của người chấm hoặc điểm của nhóm
    const scoreFilter: any = { groupId: group.id };
    if (scorerId) {
      scoreFilter.scorerId = scorerId;
    }

    const scores = await this.prisma.score.findMany({
      where: scoreFilter,
      include: { criterion: true, scorer: true },
    });

    const scorer = scores[0]?.scorer || group.topic?.owner;
    const roleLabel =
      role === 'PHAN_BIEN'
        ? 'CÁN BỘ PHẢN BIỆN'
        : role === 'HOI_DONG'
        ? 'THÀNH VIÊN HỘI ĐỒNG'
        : 'CÁN BỘ HƯỚNG DẪN';

    const totalScore = this.calculateWeightedTotal(scores);
    const classification = getRatingClassification(totalScore);
    const totalWords = scoreToWords(totalScore);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: any) => reject(err));

        // Thiết lập font chữ tiếng Việt Times New Roman nếu có trên Windows
        const timesRegular = 'C:/Windows/Fonts/times.ttf';
        const timesBold = 'C:/Windows/Fonts/timesbd.ttf';
        const timesItalic = 'C:/Windows/Fonts/timesi.ttf';
        const hasTimes = fs.existsSync(timesRegular);

        let fontRegular = 'Helvetica';
        let fontBold = 'Helvetica-Bold';
        let fontItalic = 'Helvetica-Oblique';

        if (hasTimes) {
          doc.registerFont('Times-Roman', timesRegular);
          if (fs.existsSync(timesBold)) doc.registerFont('Times-Bold', timesBold);
          if (fs.existsSync(timesItalic)) doc.registerFont('Times-Italic', timesItalic);
          fontRegular = 'Times-Roman';
          fontBold = fs.existsSync(timesBold) ? 'Times-Bold' : 'Times-Roman';
          fontItalic = fs.existsSync(timesItalic) ? 'Times-Italic' : 'Times-Roman';
        }

        const safeText = (txt: string) => {
          if (!hasTimes) return stripVietnameseDiacritics(txt);
          return txt;
        };

        // --- HEADER ---
        doc.font(fontRegular).fontSize(9).text(safeText('BỘ GIÁO DỤC VÀ ĐÀO TẠO'), 40, 40, { align: 'left' });
        doc.font(fontBold).fontSize(9).text(safeText('TRƯỜNG ĐẠI HỌC KHOA HỌC TỰ NHIÊN'), 40, 52, { align: 'left' });
        doc.font(fontRegular).fontSize(9).text(safeText('KHOA CÔNG NGHỆ THÔNG TIN'), 40, 64, { align: 'left' });

        doc.font(fontBold).fontSize(9).text(safeText('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'), 300, 40, { align: 'center' });
        doc.font(fontRegular).fontSize(9).text(safeText('Độc lập - Tự do - Hạnh phúc'), 300, 52, { align: 'center' });
        doc.moveTo(370, 65).lineTo(470, 65).stroke('#333333');

        doc.moveDown(2);

        // --- TIÊU ĐỀ BIỂU MẪU ---
        doc.font(fontBold).fontSize(14).text(safeText('PHIẾU ĐÁNH GIÁ KHÓA LUẬN TỐT NGHIỆP'), 40, 88, { align: 'center' });
        doc.font(fontItalic).fontSize(10).text(safeText(`(Dành cho: ${roleLabel})`), 40, 106, { align: 'center' });

        // --- PHẦN I: THÔNG TIN CHUNG ---
        const startY = 122;
        doc.font(fontBold).fontSize(10).text(safeText('I. THÔNG TIN CHUNG:'), 40, startY);

        doc.font(fontRegular).fontSize(9.5);
        doc.text(safeText(`1. Tên đề tài: ${group.topic?.title || group.name}`), 50, startY + 15, { width: 505 });
        doc.text(safeText(`2. Cán bộ hướng dẫn: ${group.topic?.owner?.fullName || 'N/A'}   |   Cán bộ đánh giá: ${scorer?.fullName || '................................'}`), 50, startY + 30);

        const groupMembers = group.members || [];
        const sv1 = groupMembers[0];
        const sv2 = groupMembers[1];

        doc.text(
          safeText(
            `Họ tên sinh viên 1: ${sv1?.student?.user?.fullName || '........................................'}     Mã số sinh viên: ${sv1?.student?.studentCode || '........................'}`,
          ),
          50,
          startY + 46,
        );
        doc.text(
          safeText(
            `Họ tên sinh viên 2: ${sv2?.student?.user?.fullName || '........................................'}     Mã số sinh viên: ${sv2?.student?.studentCode || '........................'}`,
          ),
          50,
          startY + 61,
        );

        // --- PHẦN II: BẢNG 10 TIÊU CHÍ ĐÁNH GIÁ (CHẤM RIÊNG TỪNG SINH VIÊN) ---
        const tableTop = startY + 80;
        doc.font(fontBold).fontSize(10).text(safeText('II. BẢNG ĐÁNH GIÁ KẾT QUẢ THỰC HIỆN (LO 01 - LO 10):'), 40, tableTop);

        // Kích thước các cột bảng (Tổng chiều rộng: 515)
        // STT (35) | LO (270) | Sinh viên 1 (70) | Sinh viên 2 (70) | Ghi chú (70)
        const colX = [40, 75, 345, 415, 485, 555];
        const rowHeaderY = tableTop + 15;
        const rowHeight = 22;

        // Vẽ Header bảng
        doc.rect(colX[0], rowHeaderY, 515, rowHeight).fillAndStroke('#f1f5f9', '#94a3b8');
        doc.fillColor('#0f172a').font(fontBold).fontSize(8.5);

        doc.text(safeText('STT'), colX[0], rowHeaderY + 6, { width: 35, align: 'center' });
        doc.text(safeText('LO'), colX[1] + 5, rowHeaderY + 6, { width: 260, align: 'center' });
        doc.text(safeText('Sinh viên 1'), colX[2], rowHeaderY + 6, { width: 70, align: 'center' });
        doc.text(safeText('Sinh viên 2'), colX[3], rowHeaderY + 6, { width: 70, align: 'center' });
        doc.text(safeText('Ghi chú'), colX[4] + 4, rowHeaderY + 6, { width: 65, align: 'center' });

        let currentY = rowHeaderY + rowHeight;
        doc.font(fontRegular).fontSize(8);

        allCriteria.forEach((tc, idx) => {
          const scoreItem = scores.find((s) => s.criterionId === tc.id || s.criterion?.code === tc.code);
          const parsedNote = parseScoreNote(scoreItem?.note);
          const sv1Val =
            scoreItem && sv1
              ? resolveStudentCriterionScore(scoreItem, [
                  sv1.student?.user?.id,
                  sv1.studentId,
                  sv1.student?.studentCode,
                ]).toFixed(1)
              : scoreItem
              ? Number(scoreItem.value).toFixed(1)
              : '-';
          const sv2Val =
            scoreItem && sv2
              ? resolveStudentCriterionScore(scoreItem, [
                  sv2.student?.user?.id,
                  sv2.studentId,
                  sv2.student?.studentCode,
                ]).toFixed(1)
              : '-';
          const noteText = parsedNote.note ? safeText(parsedNote.note.substring(0, 22)) : '';
          const rowH = tc.name.length > 65 ? 27 : rowHeight;

          // Alternate row background
          if (idx % 2 === 1) {
            doc.rect(colX[0], currentY, 515, rowH).fill('#fafafa');
          }
          doc.rect(colX[0], currentY, 515, rowH).stroke('#cbd5e1');

          doc.fillColor('#1e293b');
          doc.font(fontRegular);
          doc.text(String(idx + 1).padStart(2, '0'), colX[0], currentY + 6, { width: 35, align: 'center' });
          doc.text(safeText(tc.name), colX[1] + 5, currentY + 4, { width: 260, align: 'left' });

          doc.font(fontBold).fillColor(scoreItem ? '#047857' : '#94a3b8');
          doc.text(sv1Val, colX[2], currentY + 6, { width: 70, align: 'center' });
          doc.text(sv2Val, colX[3], currentY + 6, { width: 70, align: 'center' });

          doc.font(fontRegular).fillColor('#475569');
          doc.text(noteText, colX[4] + 4, currentY + 6, { width: 65, align: 'left' });

          currentY += rowH;
        });

        // Dòng ĐIỂM TRUNG BÌNH trong bảng
        const sv1Avg = sv1
          ? calculateStudentWeightedTotal(scores, [
              sv1.student?.user?.id,
              sv1.studentId,
              sv1.student?.studentCode,
            ])
          : totalScore;
        const sv2Avg = sv2
          ? calculateStudentWeightedTotal(scores, [
              sv2.student?.user?.id,
              sv2.studentId,
              sv2.student?.studentCode,
            ])
          : null;

        doc.rect(colX[0], currentY, 515, 22).fillAndStroke('#f8fafc', '#94a3b8');
        doc.fillColor('#0f172a').font(fontBold).fontSize(9);
        doc.text(safeText('ĐIỂM TRUNG BÌNH'), colX[0], currentY + 6, { width: 305, align: 'center' });
        doc.fillColor('#047857').text(scores.length > 0 ? sv1Avg.toFixed(2) : '-', colX[2], currentY + 6, { width: 70, align: 'center' });
        doc.text(sv2 && scores.length > 0 && sv2Avg !== null ? sv2Avg.toFixed(2) : '-', colX[3], currentY + 6, { width: 70, align: 'center' });
        currentY += 22;

        // Dòng KẾT QUẢ trong bảng
        const sv1Pass = sv1Avg >= 5.0;
        const sv2Pass = sv2Avg !== null && sv2Avg >= 5.0;
        doc.rect(colX[0], currentY, 515, 26).fillAndStroke('#f8fafc', '#94a3b8');
        doc.fillColor('#0f172a').font(fontBold).fontSize(9);
        doc.text(safeText('KẾT QUẢ'), colX[0], currentY + 8, { width: 305, align: 'center' });
        doc.fontSize(7.5);
        doc.text(
          safeText(`[${scores.length > 0 && sv1Pass ? 'x' : ' '}] Đạt\n[${scores.length > 0 && !sv1Pass ? 'x' : ' '}] Không đạt`),
          colX[2] + 6,
          currentY + 4,
          { width: 60, align: 'left' },
        );
        if (sv2) {
          doc.text(
            safeText(`[${scores.length > 0 && sv2Pass ? 'x' : ' '}] Đạt\n[${scores.length > 0 && !sv2Pass ? 'x' : ' '}] Không đạt`),
            colX[3] + 6,
            currentY + 4,
            { width: 60, align: 'left' },
          );
        }
        currentY += 26;

        // Vẽ các đường kẻ dọc ngăn cột
        doc.moveTo(colX[1], rowHeaderY).lineTo(colX[1], currentY - 48).stroke('#cbd5e1');
        for (let i = 2; i < colX.length - 1; i++) {
          doc.moveTo(colX[i], rowHeaderY).lineTo(colX[i], currentY).stroke('#cbd5e1');
        }

        // --- PHẦN III: NHẬN XÉT ---
        const resultY = currentY + 8;
        const firstCleanComment = scores.map((s) => parseScoreNote(s.note).note).find((n) => n && n.trim().length > 0) || '';
        doc.fillColor('#0f172a').font(fontRegular).fontSize(9);
        doc.text(
          safeText(
            `Nhận xét: ${
              firstCleanComment ||
              '..................................................................................................................................................'
            }`,
          ),
          50,
          resultY,
          { width: 495 },
        );

        // --- PHẦN IV: KÝ TÊN XÁC NHẬN ---
        const signY = resultY + 64;
        const now = new Date();
        const dateStr = `Ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

        doc.font(fontItalic).fontSize(9).text(safeText(`TP. Hồ Chí Minh, ${dateStr}`), 330, signY, { align: 'center', width: 215 });
        doc.font(fontBold).fontSize(9.5).text(safeText('CÁN BỘ ĐÁNH GIÁ'), 330, signY + 14, { align: 'center', width: 215 });
        doc.font(fontItalic).fontSize(8.5).text(safeText('(Ký và ghi rõ họ tên)'), 330, signY + 26, { align: 'center', width: 215 });

        // Tên giảng viên ký ở chân trang
        doc.font(fontBold).fontSize(10).text(
          safeText(scorer?.fullName || '................................................'),
          330,
          signY + 80,
          { align: 'center', width: 215 },
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  async pdf(groupId: string): Promise<Buffer> {
    return this.exportPdf(groupId);
  }

  /**
   * Lấy bảng điểm tổng hợp theo học kỳ (xem điểm thành phần + tổng và cảnh báo khi điểm chưa đầy đủ)
   */
  async findSemesterScores(query: QueryScoresDto, userId?: string) {
    await this.ensureTenCriteria();

    let semesterId = query.semesterId;
    if (!semesterId) {
      const openSemester = await this.prisma.semester.findFirst({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      });
      semesterId =
        openSemester?.id ||
        (await this.prisma.semester.findFirst({ orderBy: { createdAt: 'desc' } }))?.id;
    }

    const semester = semesterId
      ? await this.prisma.semester.findUnique({
          where: { id: semesterId },
          select: { id: true, code: true, name: true, academicYear: true, status: true },
        })
      : null;

    const groupWhere: any = {};
    if (semesterId) {
      groupWhere.semesterId = semesterId;
    }
    if (query.groupId) {
      groupWhere.id = query.groupId;
    }
    const targetLecturerId = query.lecturerId || query.gvhdId;
    if (targetLecturerId) {
      groupWhere.topic = {
        OR: [
          { ownerId: targetLecturerId },
          { owner: { lecturerProfile: { id: targetLecturerId } } },
        ],
      };
    }
    if (query.search) {
      const searchCond = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { topic: { title: { contains: query.search, mode: 'insensitive' } } },
        { topic: { owner: { fullName: { contains: query.search, mode: 'insensitive' } } } },
        { members: { some: { student: { user: { fullName: { contains: query.search, mode: 'insensitive' } } } } } },
        { members: { some: { student: { studentCode: { contains: query.search, mode: 'insensitive' } } } } },
      ];
      groupWhere.AND = [...(groupWhere.AND || []), { OR: searchCond }];
    }

    const groups = await this.prisma.group.findMany({
      where: groupWhere,
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
            reviewer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
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
        scores: {
          include: {
            criterion: true,
            scorer: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ code: 'asc' }],
    });

    // Lấy minh chứng NCKH đã duyệt của toàn bộ SV trong các nhóm
    const allStudentUserIds = groups.flatMap((g) =>
      g.members.map((m) => m.student?.user?.id).filter(Boolean) as string[],
    );
    const approvedEvidences =
      allStudentUserIds.length > 0
        ? await this.prisma.evidence.findMany({
            where: { userId: { in: allStudentUserIds }, status: 'APPROVED' },
          })
        : [];

    let items = groups.map((g) => {
      const topicOwnerId = g.topic?.ownerId;
      const reviewerUserIds = new Set<string>();
      if (g.topic?.reviewerId) reviewerUserIds.add(g.topic.reviewerId);
      for (const ra of g.reviewerAssignments) {
        if (ra.lecturer?.user?.id) reviewerUserIds.add(ra.lecturer.user.id);
      }

      // 1. Điểm GVHD
      const gvhdScores = topicOwnerId ? g.scores.filter((s) => s.scorerId === topicOwnerId) : [];
      const gvhdScoresToCalc = this.getScoresToCalculate(gvhdScores);
      const gvhdHasDraft = gvhdScoresToCalc.some((s) => s.status === 'DRAFT');
      const gvhdIsOpened = gvhdScoresToCalc.some((s) => s.status === 'OPENED');
      const gvhdIsLocked =
        gvhdScoresToCalc.length > 0 &&
        !gvhdHasDraft &&
        gvhdScoresToCalc.every((s) => s.status === 'LOCKED' || s.status === 'SUBMITTED');
      const gvhdTotal = gvhdScoresToCalc.length > 0 ? this.calculateWeightedTotal(gvhdScoresToCalc) : null;

      // 2. Điểm GVPB
      const reviewers = g.reviewerAssignments.map((ra) => {
        const revId = ra.lecturer?.user?.id;
        const revScores = revId ? g.scores.filter((s) => s.scorerId === revId) : [];
        const revScoresToCalc = this.getScoresToCalculate(revScores);
        const hasDraft = revScoresToCalc.some((s) => s.status === 'DRAFT');
        const isOpened = revScoresToCalc.some((s) => s.status === 'OPENED');
        const isLocked =
          revScoresToCalc.length > 0 &&
          !hasDraft &&
          revScoresToCalc.every((s) => s.status === 'LOCKED' || s.status === 'SUBMITTED');
        const total = revScoresToCalc.length > 0 ? this.calculateWeightedTotal(revScoresToCalc) : null;
        return {
          id: ra.id,
          lecturerId: ra.lecturerId,
          userId: revId,
          fullName: ra.lecturer?.user?.fullName || 'Giảng viên phản biện',
          email: ra.lecturer?.user?.email,
          type: ra.type,
          criteriaCount: revScoresToCalc.length,
          total,
          isComplete: revScoresToCalc.length >= 10 && !hasDraft,
          hasDraft,
          isLocked,
          isOpened,
          scores: revScoresToCalc.map((s) => ({
            criterionCode: s.criterion.code,
            criterionName: s.criterion.name,
            weight: Number(s.criterion.weight),
            value: Number(s.value),
            note: s.note,
            status: s.status,
          })),
        };
      });

      const reviewersWithScores = reviewers.filter((r) => r.total !== null);
      const gvpbTotal =
        reviewersWithScores.length > 0
          ? Number(
              (
                reviewersWithScores.reduce((sum, r) => sum + (r.total || 0), 0) /
                reviewersWithScores.length
              ).toFixed(2),
            )
          : null;

      // 3. Điểm Hội đồng
      const defense = g.defenses?.[0] || null;
      const committee = defense?.committee || null;
      const committeeMembers = (committee?.members || []).map((m: any) => {
        const memScores = g.scores.filter((s) => s.scorerId === m.userId);
        const memScoresToCalc = this.getScoresToCalculate(memScores);
        const hasDraft = memScoresToCalc.some((s) => s.status === 'DRAFT');
        const isOpened = memScoresToCalc.some((s) => s.status === 'OPENED');
        const isLocked =
          memScoresToCalc.length > 0 &&
          !hasDraft &&
          memScoresToCalc.every((s) => s.status === 'LOCKED' || s.status === 'SUBMITTED');
        const total = memScoresToCalc.length > 0 ? this.calculateWeightedTotal(memScoresToCalc) : null;
        return {
          userId: m.userId,
          fullName: m.user?.fullName || 'Ủy viên',
          role: m.role,
          criteriaCount: memScoresToCalc.length,
          total,
          isComplete: memScoresToCalc.length >= 10 && !hasDraft,
          hasDraft,
          isLocked,
          isOpened,
          scores: memScoresToCalc.map((s) => ({
            criterionCode: s.criterion.code,
            criterionName: s.criterion.name,
            weight: Number(s.criterion.weight),
            value: Number(s.value),
            note: s.note,
            status: s.status,
          })),
        };
      });

      const membersWithScores = committeeMembers.filter((m: any) => m.total !== null);
      const councilTotal =
        membersWithScores.length > 0
          ? Number(
              (
                membersWithScores.reduce((sum: number, m: any) => sum + (m.total || 0), 0) /
                membersWithScores.length
              ).toFixed(2),
            )
          : null;

      // 4. Điểm thưởng NCKH
      const grpStudentUserIds = g.members
        .map((m) => m.student?.user?.id)
        .filter(Boolean) as string[];
      const grpEvidences = approvedEvidences.filter((ev) =>
        grpStudentUserIds.includes(ev.userId),
      );
      const rawBonus = grpEvidences.reduce(
        (sum, ev) => sum + (ev.points ? Number(ev.points) : 0),
        0,
      );
      const bonusPoints = Math.min(2.0, Number(rawBonus.toFixed(2)));

      // 5. Điểm tổng kết
      let diemTongKet: number | null = null;
      let congThucTinh = '';

      const scoreComponents: Array<{ name: string; score: number }> = [];
      if (gvhdTotal !== null) scoreComponents.push({ name: 'Điểm GVHD', score: gvhdTotal });
      if (gvpbTotal !== null) scoreComponents.push({ name: 'Điểm GVPB', score: gvpbTotal });
      if (councilTotal !== null) scoreComponents.push({ name: 'Điểm Hội đồng', score: councilTotal });

      if (scoreComponents.length > 0) {
        const sum = scoreComponents.reduce((acc, c) => acc + c.score, 0);
        diemTongKet = Number((sum / scoreComponents.length).toFixed(2));

        if (scoreComponents.length === 1) {
          congThucTinh = `Điểm tổng kết = ${scoreComponents[0].name}`;
        } else {
          const names = scoreComponents.map((c) => c.name).join(' + ');
          congThucTinh = `Điểm tổng kết = (${names}) / ${scoreComponents.length}`;
        }
      } else if (g.scores.length > 0) {
        diemTongKet = this.calculateWeightedTotal(g.scores);
        congThucTinh = `Điểm tổng kết = Trung bình cộng ${g.scores.length} tiêu chí đã chấm`;
      } else {
        diemTongKet = null;
        congThucTinh = 'Chưa có điểm đánh giá';
      }

      if (bonusPoints > 0 && diemTongKet !== null) {
        diemTongKet = Math.min(10, Number((diemTongKet + bonusPoints).toFixed(2)));
        congThucTinh += ` + Điểm thưởng NCKH (+${bonusPoints}đ, tối đa 10đ)`;
      }

      const xepLoai = diemTongKet !== null ? getRatingClassification(diemTongKet) : 'Chưa xếp loại';
      const ketQua =
        diemTongKet !== null ? (diemTongKet >= 5.0 ? 'DAT' : 'KHONG_DAT') : 'CHUA_CO_KET_QUA';

      // 6. Cảnh báo khi điểm chưa đầy đủ (Kiểm tra trạng thái giữa kỳ trước tiên)
      const warnings: string[] = [];
      const missingComponents: string[] = [];

      if (g.midtermStatus === 'STOPPED') {
        missingComponents.push('DA_DUNG_GIUA_KY');
        warnings.push('Nhóm đã dừng thực hiện đề tài ở đánh giá giữa kỳ (Không thực hiện chấm điểm bảo vệ)');
      } else if (g.midtermStatus !== 'CONTINUE') {
        missingComponents.push('CHUA_XAC_NHAN_GIUA_KY');
        warnings.push(
          `Chưa xác nhận kết quả giữa kỳ — GVHD (${g.topic?.owner?.fullName || 'GVHD'}) cần xác nhận CHO LÀM TIẾP trước khi mở nhập điểm`,
        );
      } else {
        // Kiểm tra GVHD
        if (gvhdScores.length === 0) {
          missingComponents.push('THIEU_DIEM_GVHD');
          warnings.push(
            `Chưa có điểm từ Cán bộ Hướng dẫn (${g.topic?.owner?.fullName || 'GVHD'})`,
          );
        } else {
          if (gvhdScoresToCalc.length < 10) {
            missingComponents.push('GVHD_CHUA_DU_10_TIEU_CHI');
            warnings.push(`Cán bộ Hướng dẫn mới chấm ${gvhdScoresToCalc.length}/10 tiêu chí`);
          }
          if (gvhdHasDraft) {
            missingComponents.push('GVHD_DIEM_NHAP');
            warnings.push(
              'Điểm của Cán bộ Hướng dẫn vẫn đang ở trạng thái Bản nháp (DRAFT), chưa khóa điểm',
            );
          }
          if (gvhdIsOpened) {
            missingComponents.push('GVHD_DIEM_MO_KHOA');
            warnings.push('Điểm của Cán bộ Hướng dẫn đang được mở khóa để chỉnh sửa');
          }
        }

        // Kiểm tra GVPB
        if (g.reviewerAssignments.length === 0) {
          missingComponents.push('CHUA_PHAN_CONG_GVPB');
          warnings.push('Nhóm chưa được phân công Giảng viên phản biện (GVPB)');
        } else {
          for (const ra of g.reviewerAssignments) {
            const revName = ra.lecturer?.user?.fullName || 'Cán bộ phản biện';
            const rScores = ra.lecturer?.user?.id
              ? g.scores.filter((s) => s.scorerId === ra.lecturer?.user?.id)
              : [];
            if (rScores.length === 0) {
              missingComponents.push('THIEU_DIEM_GVPB');
              warnings.push(`GVPB (${revName}) chưa nhập điểm`);
            } else {
              if (rScores.length < 10) {
                missingComponents.push('GVPB_CHUA_DU_10_TIEU_CHI');
                warnings.push(`GVPB (${revName}) mới chấm ${rScores.length}/10 tiêu chí`);
              }
              if (rScores.some((s) => s.status === 'DRAFT')) {
                missingComponents.push('GVPB_DIEM_NHAP');
                warnings.push(`Điểm của GVPB (${revName}) vẫn đang ở trạng thái Bản nháp`);
              }
              if (rScores.some((s) => s.status === 'OPENED')) {
                missingComponents.push('GVPB_DIEM_MO_KHOA');
                warnings.push(`Điểm của GVPB (${revName}) đang được mở khóa để chỉnh sửa`);
              }
            }
          }
        }

        // Kiểm tra Hội đồng
        if (g.defenses.length === 0) {
          missingComponents.push('CHUA_XEP_LICH_HOI_DONG');
          warnings.push('Nhóm chưa được xếp lịch bảo vệ Hội đồng');
        } else {
          if (!committee) {
            missingComponents.push('CHUA_GAN_HOI_DONG');
            warnings.push('Lịch bảo vệ chưa được gán Hội đồng đánh giá');
          } else {
            const unratedMembers = committee.members.filter(
              (m: any) => !g.scores.some((s) => s.scorerId === m.userId),
            );
            if (unratedMembers.length > 0) {
              missingComponents.push('THIEU_DIEM_HOI_DONG');
              const unratedNames = unratedMembers
                .map((m: any) => m.user?.fullName || 'Ủy viên')
                .join(', ');
              warnings.push(
                `Hội đồng bảo vệ chưa đủ điểm (${
                  committee.members.length - unratedMembers.length
                }/${committee.members.length} thành viên đã chấm, còn thiếu: ${unratedNames})`,
              );
            }
            for (const m of committee.members) {
              const mScores = g.scores.filter((s) => s.scorerId === m.userId);
              if (mScores.length > 0) {
                if (mScores.length < 10) {
                  missingComponents.push('HOI_DONG_CHUA_DU_10_TIEU_CHI');
                  warnings.push(
                    `Thành viên HĐ (${m.user?.fullName}) mới chấm ${mScores.length}/10 tiêu chí`,
                  );
                }
                if (mScores.some((s) => s.status === 'DRAFT')) {
                  missingComponents.push('HOI_DONG_DIEM_NHAP');
                  warnings.push(
                    `Điểm của Thành viên HĐ (${m.user?.fullName}) vẫn đang ở trạng thái Bản nháp`,
                  );
                }
                if (mScores.some((s) => s.status === 'OPENED')) {
                  missingComponents.push('HOI_DONG_DIEM_MO_KHOA');
                  warnings.push(
                    `Điểm của Thành viên HĐ (${m.user?.fullName}) đang được mở khóa để chỉnh sửa`,
                  );
                }
              }
            }
          }
        }
      }

      const isReadyForDefense = g.midtermStatus === 'CONTINUE' && g.status !== 'CANCELLED';
      const isComplete = isReadyForDefense && missingComponents.length === 0 && warnings.length === 0;
      const hasWarning = warnings.length > 0;
      const primaryReviewer = reviewers[0]
        ? { id: reviewers[0].userId, fullName: reviewers[0].fullName, email: reviewers[0].email }
        : g.topic?.reviewer || null;

      // Tính điểm chi tiết riêng cho từng sinh viên trong nhóm
      const studentScoresList = g.members.map((m) => {
        const uId = m.student?.user?.id;
        const sId = m.studentId;
        const sCode = m.student?.studentCode;
        const keys = [uId, sId, sCode];

        const stGvhd =
          gvhdScoresToCalc.length > 0
            ? calculateStudentWeightedTotal(gvhdScoresToCalc, keys)
            : null;

        const stRevScores = g.reviewerAssignments
          .map((ra) => {
            const revId = ra.lecturer?.user?.id;
            const rScores = revId ? this.getScoresToCalculate(g.scores.filter((s) => s.scorerId === revId)) : [];
            return rScores.length > 0 ? calculateStudentWeightedTotal(rScores, keys) : null;
          })
          .filter((v): v is number => v !== null);
        const stGvpb =
          stRevScores.length > 0
            ? Number((stRevScores.reduce((a, b) => a + b, 0) / stRevScores.length).toFixed(2))
            : null;

        const stCouncilScores = (committee?.members || [])
          .map((cm: any) => {
            const cScores = this.getScoresToCalculate(g.scores.filter((s) => s.scorerId === cm.userId));
            return cScores.length > 0 ? calculateStudentWeightedTotal(cScores, keys) : null;
          })
          .filter((v: number | null): v is number => v !== null);
        const stCouncil =
          stCouncilScores.length > 0
            ? Number(
                (
                  stCouncilScores.reduce((a: number, b: number) => a + b, 0) /
                  stCouncilScores.length
                ).toFixed(2),
              )
            : null;

        const stEvidences = approvedEvidences.filter((ev) => ev.userId === uId);
        const stRawBonus = stEvidences.reduce((sum, ev) => sum + (ev.points ? Number(ev.points) : 0), 0);
        const stBonus = Math.min(2.0, Number(stRawBonus.toFixed(2)));

        const stParts = [stGvhd, stGvpb, stCouncil].filter((v): v is number => v !== null);
        let stFinal: number | null = null;
        if (stParts.length > 0) {
          stFinal = Number((stParts.reduce((a, b) => a + b, 0) / stParts.length).toFixed(2));
          if (stBonus > 0) {
            stFinal = Math.min(10, Number((stFinal + stBonus).toFixed(2)));
          }
        }

        return {
          studentId: m.studentId,
          userId: uId,
          fullName: m.student?.user?.fullName,
          studentCode: m.student?.studentCode,
          email: m.student?.user?.email,
          phone: m.student?.user?.phone,
          department: m.student?.department?.name,
          isLeader: m.isLeader,
          gvhd: stGvhd,
          gvpb: stGvpb,
          council: stCouncil,
          bonusPoints: stBonus,
          finalScore: stFinal,
          xepLoai: stFinal !== null ? getRatingClassification(stFinal) : 'Chưa xếp loại',
          ketQua: stFinal !== null ? (stFinal >= 5.0 ? 'DAT' : 'KHONG_DAT') : 'CHUA_CO_KET_QUA',
        };
      });

      return {
        id: g.id,
        code: g.code,
        name: g.name,
        status: g.status,
        midtermStatus: g.midtermStatus,
        group: {
          id: g.id,
          code: g.code,
          name: g.name,
          status: g.status,
          midtermStatus: g.midtermStatus,
        },
        topic: g.topic
          ? {
              id: g.topic.id,
              title: g.topic.title,
              owner: g.topic.owner,
              reviewer: g.topic.reviewer,
            }
          : null,
        reviewer: primaryReviewer,
        students: studentScoresList,
        studentScores: studentScoresList,
        isReadyForDefense,
        defenseSchedule: defense
          ? {
              id: defense.id,
              startsAt: defense.startsAt,
              endsAt: defense.endsAt,
              room: defense.room,
              status: defense.status,
              committee: committee
                ? {
                    id: committee.id,
                    name: committee.name,
                    membersCount: committee.members?.length || 0,
                  }
                : null,
            }
          : null,
        scores: {
          gvhd: gvhdTotal,
          gvpb: gvpbTotal,
          council: councilTotal,
          bonusPoints,
          councilEvaluationsCount: membersWithScores.length,
          councilMembersCount: committeeMembers.length,
        },
        scoreBreakdown: {
          gvhd: {
            isDraft: gvhdHasDraft,
            isLocked: gvhdIsLocked,
            isOpened: gvhdIsOpened,
            total: gvhdTotal,
          },
          gvpb: {
            isDraft: reviewers.some((r) => r.hasDraft),
            isLocked: reviewers.length > 0 && reviewers.every((r) => r.isLocked),
            total: gvpbTotal,
          },
          council: {
            evaluations: committeeMembers.map((cm: any) => ({
              lecturerName: cm.fullName,
              role: cm.role,
              count: cm.criteriaCount,
              isDraft: cm.hasDraft,
              totalScore: cm.total,
            })),
          },
        },
        componentScores: {
          gvhd: {
            scorer: g.topic?.owner || null,
            total: gvhdTotal,
            criteriaCount: gvhdScoresToCalc.length,
            isComplete: gvhdScoresToCalc.length >= 10 && !gvhdHasDraft,
            hasDraft: gvhdHasDraft,
            isLocked: gvhdIsLocked,
            isOpened: gvhdIsOpened,
            scores: gvhdScoresToCalc.map((s) => ({
              criterionCode: s.criterion.code,
              criterionName: s.criterion.name,
              weight: Number(s.criterion.weight),
              value: Number(s.value),
              note: s.note,
              status: s.status,
            })),
          },
          gvpb: {
            total: gvpbTotal,
            reviewers,
            isComplete:
              reviewers.length > 0 &&
              reviewers.every((r) => r.isComplete),
          },
          council: {
            committeeName: committee?.name || null,
            total: councilTotal,
            members: committeeMembers,
            isComplete:
              committeeMembers.length > 0 &&
              committeeMembers.every((m: any) => m.isComplete),
          },
          bonusPoints,
          approvedEvidences: grpEvidences.map((ev) => ({
            id: ev.id,
            title: ev.title,
            points: Number(ev.points || 0),
          })),
        },
        finalScore: diemTongKet,
        rating: xepLoai,
        xepLoai,
        result: ketQua,
        ketQua,
        formula: congThucTinh,
        congThucTinh,
        scoreCompleteness: {
          isComplete,
          hasWarning,
          missingComponents,
          warnings,
        },
      };
    });

    if (query.incompleteOnly === 'true') {
      items = items.filter((it) => !it.scoreCompleteness.isComplete);
    }

    const totalGroups = items.length;
    const readyForDefenseCount = items.filter((it) => it.isReadyForDefense).length;
    const completeScoresCount = items.filter((it) => it.scoreCompleteness.isComplete).length;
    const incompleteScoresCount = items.filter((it) => !it.scoreCompleteness.isComplete).length;
    const itemsWithFinalScore = items.filter((it) => it.finalScore !== null);
    const averageFinalScore =
      itemsWithFinalScore.length > 0
        ? Number(
            (
              itemsWithFinalScore.reduce((sum, it) => sum + (it.finalScore || 0), 0) /
              itemsWithFinalScore.length
            ).toFixed(2),
          )
        : null;

    return {
      semester,
      summary: {
        totalGroups,
        readyForDefenseCount,
        completeScoresCount,
        incompleteScoresCount,
        hasWarning: incompleteScoresCount > 0,
        averageFinalScore,
      },
      items,
    };
  }
}
