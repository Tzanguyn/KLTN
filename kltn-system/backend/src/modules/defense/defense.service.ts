import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssignReviewerDto } from './dto/assign-reviewer.dto';
import { AssignReviewersDto } from './dto/assign-reviewers.dto';
import { AssignThirdReviewerDto } from './dto/assign-third-reviewer.dto';
import { AssignGroupsToCommitteeDto } from './dto/assign-groups-to-committee.dto';
import { ClassifyDefenseFormatsDto } from './dto/classify-defense-formats.dto';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { CreateDefenseCommitteeDto } from './dto/create-defense-committee.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { ScheduleDefenseDto } from './dto/schedule-defense.dto';

@Injectable()
export class DefenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Tính điểm trung bình của Cán bộ Hướng dẫn (GVHD) theo các tiêu chí đã chấm
   */
  calculateGvhdScore(advisorUserId?: string | null, scores?: Array<any>): number | null {
    if (!advisorUserId || !scores || scores.length === 0) return null;
    const gvhdScores = scores.filter((s) => s.scorerId === advisorUserId);
    if (gvhdScores.length === 0) return null;
    const tcScores = gvhdScores.filter((s) => s.criterion?.code?.startsWith('TC'));
    const scoresToCalc = tcScores.length > 0 ? tcScores : gvhdScores;
    const total = scoresToCalc.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
    return Number((total / scoresToCalc.length).toFixed(2));
  }

  /**
   * Tính điểm trung bình của các Giảng viên phản biện (GVPB)
   * Quy định:
   * - Nếu điểm giữa 2 GVPB chênh nhau >= 4 điểm HOẶC điểm của GVPB và GVHD chênh nhau >= 2 điểm, Trưởng bộ môn phân công GVPB thứ 3.
   * - Khi đó điểm của GVPB là trung bình của 3 GVPB.
   */
  calculateReviewerScore(
    reviewerAssignments?: Array<any>,
    scores?: Array<any>,
    gvhdScore?: number | null,
  ): {
    score: number | null;
    reviewerCount: number;
    completedReviewerCount: number;
    reviewers: Array<{
      lecturerId: string;
      userId?: string;
      fullName?: string;
      type?: string;
      score: number | null;
      criteriaCount: number;
      isComplete: boolean;
    }>;
    hasDiscrepancy: boolean;
    needsThirdReviewer: boolean;
    hasThirdReviewer: boolean;
    isReviewersDiscrepancy: boolean;
    isGvhdDiscrepancy: boolean;
    diffReviewers: number | null;
    diffGvhd1: number | null;
    diffGvhd2: number | null;
    discrepancyReasons: string[];
    formula: string;
  } {
    if (!reviewerAssignments || reviewerAssignments.length === 0 || !scores || scores.length === 0) {
      return {
        score: null,
        reviewerCount: reviewerAssignments?.length || 0,
        completedReviewerCount: 0,
        reviewers: [],
        hasDiscrepancy: false,
        needsThirdReviewer: false,
        hasThirdReviewer: (reviewerAssignments?.length || 0) >= 3,
        isReviewersDiscrepancy: false,
        isGvhdDiscrepancy: false,
        diffReviewers: null,
        diffGvhd1: null,
        diffGvhd2: null,
        discrepancyReasons: [],
        formula: 'Chưa có điểm đánh giá phản biện',
      };
    }

    const reviewersData: Array<any> = [];
    const reviewerScores: number[] = [];

    for (const ra of reviewerAssignments) {
      const revUserId = ra.lecturer?.user?.id || (ra as any).userId;
      const revName = ra.lecturer?.user?.fullName || 'Giảng viên phản biện';
      const type = ra.type;

      if (!revUserId) {
        reviewersData.push({
          lecturerId: ra.lecturerId,
          fullName: revName,
          type,
          score: null,
          criteriaCount: 0,
          isComplete: false,
        });
        continue;
      }

      const revScores = scores.filter((s) => s.scorerId === revUserId);
      const tcScores = revScores.filter((s) => s.criterion?.code?.startsWith('TC'));
      const scoresToCalc = tcScores.length > 0 ? tcScores : revScores;

      if (scoresToCalc.length === 0) {
        reviewersData.push({
          lecturerId: ra.lecturerId,
          userId: revUserId,
          fullName: revName,
          type,
          score: null,
          criteriaCount: 0,
          isComplete: false,
        });
        continue;
      }

      const total = scoresToCalc.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      const revScore = Number((total / scoresToCalc.length).toFixed(2));
      const hasDraft = scoresToCalc.some((s) => s.status === 'DRAFT');
      const isComplete = scoresToCalc.length >= 10 && !hasDraft;

      reviewersData.push({
        lecturerId: ra.lecturerId,
        userId: revUserId,
        fullName: revName,
        type,
        score: revScore,
        criteriaCount: scoresToCalc.length,
        isComplete,
      });

      reviewerScores.push(revScore);
    }

    // Kiểm tra độ lệch điểm theo quy chế:
    // Chênh nhau giữa 2 GVPB >= 4 điểm HOẶC chênh giữa GVPB và GVHD >= 2 điểm
    let isReviewersDiscrepancy = false;
    let isGvhdDiscrepancy = false;
    let diffReviewers: number | null = null;
    let diffGvhd1: number | null = null;
    let diffGvhd2: number | null = null;
    const discrepancyReasons: string[] = [];

    if (reviewersData.length >= 2) {
      const r1 = reviewersData[0];
      const r2 = reviewersData[1];
      if (r1?.score !== null && r2?.score !== null) {
        diffReviewers = Number(Math.abs(r1.score - r2.score).toFixed(2));
        if (diffReviewers >= 4.0) {
          isReviewersDiscrepancy = true;
          discrepancyReasons.push(
            `Điểm giữa 2 GVPB chênh lệch ${diffReviewers}đ (>= 4.0đ) [GVPB 1 (${r1.fullName}): ${r1.score}, GVPB 2 (${r2.fullName}): ${r2.score}]`,
          );
        }

        if (gvhdScore !== null && gvhdScore !== undefined) {
          diffGvhd1 = Number(Math.abs(r1.score - gvhdScore).toFixed(2));
          diffGvhd2 = Number(Math.abs(r2.score - gvhdScore).toFixed(2));
          if (diffGvhd1 >= 2.0) {
            isGvhdDiscrepancy = true;
            discrepancyReasons.push(
              `Điểm GVPB 1 và GVHD chênh lệch ${diffGvhd1}đ (>= 2.0đ) [GVPB 1 (${r1.fullName}): ${r1.score}, GVHD: ${gvhdScore}]`,
            );
          }
          if (diffGvhd2 >= 2.0) {
            isGvhdDiscrepancy = true;
            discrepancyReasons.push(
              `Điểm GVPB 2 và GVHD chênh lệch ${diffGvhd2}đ (>= 2.0đ) [GVPB 2 (${r2.fullName}): ${r2.score}, GVHD: ${gvhdScore}]`,
            );
          }
        }
      }
    }

    const hasDiscrepancy = isReviewersDiscrepancy || isGvhdDiscrepancy;
    const hasThirdReviewer = (reviewerAssignments?.length || 0) >= 3;
    const needsThirdReviewer = hasDiscrepancy && !hasThirdReviewer;

    let overallScore: number | null = null;
    let formula = '';

    if (hasThirdReviewer) {
      // Khi đã phân công GVPB thứ 3: Điểm GVPB là trung bình cộng của cả 3 GVPB
      if (reviewerScores.length >= 3) {
        const sum3 = reviewerScores[0] + reviewerScores[1] + reviewerScores[2];
        overallScore = Number((sum3 / 3).toFixed(2));
        formula = `Điểm GVPB = (${reviewerScores[0]} + ${reviewerScores[1]} + ${reviewerScores[2]}) / 3 = ${overallScore} (Trung bình cộng 3 GVPB)`;
      } else {
        overallScore = null;
        formula = `Đang chờ GVPB thứ 3 chấm điểm (đã có ${reviewerScores.length}/3 GVPB chấm)`;
      }
    } else if (needsThirdReviewer) {
      // Lệch điểm nhưng chưa phân công GVPB thứ 3 -> Chưa thể chốt điểm GVPB
      overallScore = null;
      formula = `Cần phân công GVPB thứ 3 do lệch điểm (${discrepancyReasons.join('; ')})`;
    } else if (reviewerScores.length > 0) {
      overallScore = Number((reviewerScores.reduce((sum, s) => sum + s, 0) / reviewerScores.length).toFixed(2));
      formula = `Điểm GVPB = (${reviewerScores.join(' + ')}) / ${reviewerScores.length} = ${overallScore}`;
    }

    const completedCount = reviewersData.filter((r) => r.isComplete).length;

    return {
      score: overallScore,
      reviewerCount: reviewerAssignments.length,
      completedReviewerCount: completedCount,
      reviewers: reviewersData,
      hasDiscrepancy,
      needsThirdReviewer,
      hasThirdReviewer,
      isReviewersDiscrepancy,
      isGvhdDiscrepancy,
      diffReviewers,
      diffGvhd1,
      diffGvhd2,
      discrepancyReasons,
      formula,
    };
  }

  /**
   * Lấy danh sách phân luồng hình thức bảo vệ:
   * Sau khi có điểm phản biện, 20% đề tài có điểm cao nhất được báo cáo Hội đồng, 80% còn lại báo cáo Poster.
   */
  async getClassifiedDefenseFormats(semesterId?: string, topPercentage: number = 20) {
    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSemester = await this.prisma.semester.findFirst({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      });
      targetSemesterId = activeSemester?.id;
    }

    if (!targetSemesterId) {
      const anySemester = await this.prisma.semester.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      targetSemesterId = anySemester?.id;
    }

    if (!targetSemesterId) {
      return {
        semesterId: null,
        topPercentage,
        totalGroups: 0,
        eligibleGroupsCount: 0,
        reviewedGroupsCount: 0,
        awaitingReviewCount: 0,
        ineligibleCount: 0,
        councilCount: 0,
        posterCount: 0,
        minReviewScoreForCouncil: null,
        isSaved: false,
        savedAt: null,
        items: [],
      };
    }

    const groups = await this.prisma.group.findMany({
      where: {
        semesterId: targetSemesterId,
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
                lecturerProfile: { select: { id: true, lecturerCode: true } },
              },
            },
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
        scores: {
          include: { criterion: true },
        },
        defenses: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            committee: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    // Kiểm tra cấu hình đã lưu trong SystemConfig
    const savedConfig = await this.prisma.systemConfig.findFirst({
      where: {
        key: 'DEFENSE_FORMAT_CLASSIFICATION',
        semesterId: targetSemesterId,
      },
    });

    const savedData = (savedConfig?.value as any) || null;
    const savedGroupMap: Record<string, any> = savedData?.groups || {};

    // Tính điểm GVHD và điểm GVPB cho từng nhóm
    const mappedGroups = groups.map((g) => {
      const gvhdScore = this.calculateGvhdScore(g.topic?.ownerId, g.scores);
      const isMidtermPassed = g.midtermStatus === 'CONTINUE';
      const isGvhdScorePassed = gvhdScore !== null && gvhdScore >= 6.0;
      const isEligibleForDefense = isMidtermPassed && isGvhdScorePassed;

      const reviewerResult = this.calculateReviewerScore(g.reviewerAssignments, g.scores, gvhdScore);
      const reviewerScore = reviewerResult.score;

      return {
        group: g,
        gvhdScore,
        isMidtermPassed,
        isGvhdScorePassed,
        isEligibleForDefense,
        reviewerScore,
        reviewerResult,
      };
    });

    // Nhóm đủ điều kiện và đã có điểm phản biện để xếp hạng
    const groupsToRank = mappedGroups.filter(
      (item) => item.isEligibleForDefense && item.reviewerScore !== null,
    );

    // Sắp xếp giảm dần theo reviewerScore, sau đó gvhdScore, sau đó mã nhóm
    groupsToRank.sort((a, b) => {
      if (b.reviewerScore! !== a.reviewerScore!) {
        return b.reviewerScore! - a.reviewerScore!;
      }
      const aGvhd = a.gvhdScore ?? 0;
      const bGvhd = b.gvhdScore ?? 0;
      if (bGvhd !== aGvhd) {
        return bGvhd - aGvhd;
      }
      return a.group.code.localeCompare(b.group.code);
    });

    const N = groupsToRank.length;
    const pct = Math.max(1, Math.min(100, Number(topPercentage) || 20));
    const councilCount = N > 0 ? Math.max(1, Math.round(N * (pct / 100))) : 0;
    const posterCount = Math.max(0, N - councilCount);

    const resultItems: any[] = [];

    // 1. Phân luồng cho nhóm đã có điểm phản biện (Top 20% Hội đồng, 80% Poster)
    groupsToRank.forEach((item, index) => {
      const rank = index + 1;
      const isTopPct = rank <= councilCount;
      const defaultFormat = isTopPct ? 'HOI_DONG' : 'POSTER';

      const savedEntry = savedGroupMap[item.group.id];
      const officialFormat = savedEntry?.defenseFormat || defaultFormat;

      const formatName =
        officialFormat === 'HOI_DONG'
          ? `Báo cáo Hội đồng (Top ${pct}%)`
          : `Báo cáo Poster (${100 - pct}% còn lại)`;

      resultItems.push({
        id: item.group.id,
        code: item.group.code,
        name: item.group.name,
        topicTitle: item.group.topic?.title || item.group.name,
        advisorName: item.group.topic?.owner?.fullName || 'Chưa phân công',
        advisorUserId: item.group.topic?.ownerId,
        memberCount: item.group.members.length,
        members: item.group.members.map((m: any) => ({
          fullName: m.student?.user?.fullName,
          studentCode: m.student?.studentCode,
        })),
        gvhdScore: item.gvhdScore,
        reviewerScore: item.reviewerScore,
        reviewerDetails: item.reviewerResult.reviewers,
        reviewerCount: item.reviewerResult.reviewerCount,
        completedReviewerCount: item.reviewerResult.completedReviewerCount,
        rank,
        totalRanked: N,
        defenseFormat: officialFormat,
        defenseFormatName: formatName,
        isCouncilEligible: officialFormat === 'HOI_DONG',
        isTopPercentage: isTopPct,
        status: 'CLASSIFIED',
        note:
          savedEntry?.note ||
          (isTopPct
            ? `Top ${pct}% điểm phản biện cao nhất (${item.reviewerScore}đ)`
            : `Thuộc ${100 - pct}% còn lại (${item.reviewerScore}đ)`),
        schedule: item.group.defenses[0] || null,
        committee: item.group.defenses[0]?.committee || null,
      });
    });

    // 2. Nhóm đủ điều kiện nhưng chưa có điểm phản biện
    const awaitingReviewGroups = mappedGroups.filter(
      (item) => item.isEligibleForDefense && item.reviewerScore === null,
    );
    awaitingReviewGroups.forEach((item) => {
      const savedEntry = savedGroupMap[item.group.id];
      resultItems.push({
        id: item.group.id,
        code: item.group.code,
        name: item.group.name,
        topicTitle: item.group.topic?.title || item.group.name,
        advisorName: item.group.topic?.owner?.fullName || 'Chưa phân công',
        advisorUserId: item.group.topic?.ownerId,
        memberCount: item.group.members.length,
        members: item.group.members.map((m: any) => ({
          fullName: m.student?.user?.fullName,
          studentCode: m.student?.studentCode,
        })),
        gvhdScore: item.gvhdScore,
        reviewerScore: null,
        reviewerDetails: item.reviewerResult.reviewers,
        reviewerCount: item.reviewerResult.reviewerCount,
        completedReviewerCount: item.reviewerResult.completedReviewerCount,
        rank: null,
        totalRanked: N,
        defenseFormat: savedEntry?.defenseFormat || 'CHUA_PHAN_LOAI',
        defenseFormatName: 'Chờ điểm phản biện',
        isCouncilEligible: false,
        isTopPercentage: false,
        status: 'AWAITING_REVIEW',
        note: 'Chưa có đủ điểm từ Giảng viên phản biện để tính thứ hạng',
        schedule: item.group.defenses[0] || null,
        committee: item.group.defenses[0]?.committee || null,
      });
    });

    // 3. Nhóm không đủ điều kiện (Dừng giữa kỳ hoặc Điểm GVHD < 6.0)
    const ineligibleGroups = mappedGroups.filter((item) => !item.isEligibleForDefense);
    ineligibleGroups.forEach((item) => {
      let reason = 'Không đủ điều kiện bảo vệ';
      if (!item.isMidtermPassed) {
        reason = 'Không được xác nhận CHO LÀM TIẾP ở giữa kỳ';
      } else if (item.gvhdScore === null) {
        reason = 'Chưa có điểm từ Giảng viên hướng dẫn (Yêu cầu GVHD >= 6.0)';
      } else if (item.gvhdScore < 6.0) {
        reason = `Điểm GVHD là ${item.gvhdScore} (< 6.0), không đạt yêu cầu`;
      }

      resultItems.push({
        id: item.group.id,
        code: item.group.code,
        name: item.group.name,
        topicTitle: item.group.topic?.title || item.group.name,
        advisorName: item.group.topic?.owner?.fullName || 'Chưa phân công',
        advisorUserId: item.group.topic?.ownerId,
        memberCount: item.group.members.length,
        members: item.group.members.map((m: any) => ({
          fullName: m.student?.user?.fullName,
          studentCode: m.student?.studentCode,
        })),
        gvhdScore: item.gvhdScore,
        reviewerScore: item.reviewerScore,
        reviewerDetails: item.reviewerResult.reviewers,
        reviewerCount: item.reviewerResult.reviewerCount,
        completedReviewerCount: item.reviewerResult.completedReviewerCount,
        rank: null,
        totalRanked: N,
        defenseFormat: 'KHONG_DU_DIEU_KIEN',
        defenseFormatName: 'Không đủ điều kiện',
        isCouncilEligible: false,
        isTopPercentage: false,
        status: 'INELIGIBLE',
        note: reason,
        schedule: item.group.defenses[0] || null,
        committee: item.group.defenses[0]?.committee || null,
      });
    });

    const minCouncilScore =
      councilCount > 0 && groupsToRank.length >= councilCount
        ? groupsToRank[councilCount - 1].reviewerScore
        : null;

    return {
      semesterId: targetSemesterId,
      topPercentage: pct,
      totalGroups: groups.length,
      eligibleGroupsCount: mappedGroups.filter((m) => m.isEligibleForDefense).length,
      reviewedGroupsCount: N,
      awaitingReviewCount: awaitingReviewGroups.length,
      ineligibleCount: ineligibleGroups.length,
      councilCount,
      posterCount,
      minReviewScoreForCouncil: minCouncilScore,
      isSaved: !!savedConfig,
      savedAt: savedConfig?.updatedAt || null,
      items: resultItems,
    };
  }

  /**
   * Lưu chính thức kết quả phân luồng vào SystemConfig
   */
  async classifyAndSaveDefenseFormats(userId: string, dto: ClassifyDefenseFormatsDto) {
    const topPercentage = dto.topPercentage || 20;
    const classification = await this.getClassifiedDefenseFormats(dto.semesterId, topPercentage);

    const groupsMap: Record<string, any> = {};
    for (const item of classification.items) {
      groupsMap[item.id] = {
        code: item.code,
        name: item.name,
        defenseFormat: item.defenseFormat,
        defenseFormatName: item.defenseFormatName,
        reviewerScore: item.reviewerScore,
        gvhdScore: item.gvhdScore,
        rank: item.rank,
        isCouncilEligible: item.isCouncilEligible,
        note: item.note,
      };
    }

    // Áp dụng overrides nếu có
    if (dto.overrides && dto.overrides.length > 0) {
      for (const ov of dto.overrides) {
        if (groupsMap[ov.groupId]) {
          groupsMap[ov.groupId].defenseFormat = ov.defenseFormat;
          groupsMap[ov.groupId].defenseFormatName =
            ov.defenseFormat === 'HOI_DONG'
              ? `Báo cáo Hội đồng (Đã điều chỉnh)`
              : `Báo cáo Poster (Đã điều chỉnh)`;
          groupsMap[ov.groupId].isCouncilEligible = ov.defenseFormat === 'HOI_DONG';
          if (ov.note) {
            groupsMap[ov.groupId].note = ov.note;
          }
        }
      }
    }

    const payload = {
      classifiedAt: new Date().toISOString(),
      classifiedBy: userId,
      topPercentage,
      note:
        dto.note ||
        `Phân luồng tự động Top ${topPercentage}% đề tài điểm phản biện cao nhất báo cáo Hội đồng, ${
          100 - topPercentage
        }% còn lại báo cáo Poster`,
      summary: {
        totalGroups: classification.totalGroups,
        reviewedGroupsCount: classification.reviewedGroupsCount,
        councilCount: classification.councilCount,
        posterCount: classification.posterCount,
        minReviewScoreForCouncil: classification.minReviewScoreForCouncil,
      },
      groups: groupsMap,
    };

    const existingConfig = await this.prisma.systemConfig.findFirst({
      where: {
        key: 'DEFENSE_FORMAT_CLASSIFICATION',
        semesterId: classification.semesterId,
      },
    });

    if (existingConfig) {
      await this.prisma.systemConfig.update({
        where: { id: existingConfig.id },
        data: {
          value: payload,
          description: `Phân luồng hình thức bảo vệ KLTN (Top ${topPercentage}% Hội đồng - ${
            100 - topPercentage
          }% Poster)`,
        },
      });
    } else {
      await this.prisma.systemConfig.create({
        data: {
          key: 'DEFENSE_FORMAT_CLASSIFICATION',
          semesterId: classification.semesterId,
          value: payload,
          description: `Phân luồng hình thức bảo vệ KLTN (Top ${topPercentage}% Hội đồng - ${
            100 - topPercentage
          }% Poster)`,
        },
      });
    }

    return {
      message: `Đã lưu kết quả phân luồng thành công: ${classification.councilCount} nhóm báo cáo Hội đồng (Top ${topPercentage}%) và ${classification.posterCount} nhóm báo cáo Poster.`,
      classification: await this.getClassifiedDefenseFormats(dto.semesterId, topPercentage),
    };
  }

  /**
   * Lấy hình thức bảo vệ (Hội đồng hoặc Poster) của một nhóm
   */
  async getGroupDefenseFormat(groupId: string, semesterId?: string): Promise<{
    defenseFormat: 'HOI_DONG' | 'POSTER' | 'CHUA_PHAN_LOAI' | 'KHONG_DU_DIEU_KIEN';
    defenseFormatName: string;
    rank: number | null;
    reviewerScore: number | null;
    gvhdScore: number | null;
  }> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { semesterId: true },
    });
    const targetSemesterId = semesterId || group?.semesterId;

    const savedConfig = await this.prisma.systemConfig.findFirst({
      where: {
        key: 'DEFENSE_FORMAT_CLASSIFICATION',
        semesterId: targetSemesterId || undefined,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (savedConfig?.value) {
      const val = savedConfig.value as any;
      if (val.groups && val.groups[groupId]) {
        const gInfo = val.groups[groupId];
        return {
          defenseFormat: gInfo.defenseFormat,
          defenseFormatName: gInfo.defenseFormatName,
          rank: gInfo.rank ?? null,
          reviewerScore: gInfo.reviewerScore ?? null,
          gvhdScore: gInfo.gvhdScore ?? null,
        };
      }
    }

    const classification = await this.getClassifiedDefenseFormats(targetSemesterId);
    const found = classification.items.find((item: any) => item.id === groupId);
    if (found) {
      return {
        defenseFormat: found.defenseFormat,
        defenseFormatName: found.defenseFormatName,
        rank: found.rank,
        reviewerScore: found.reviewerScore,
        gvhdScore: found.gvhdScore,
      };
    }

    return {
      defenseFormat: 'CHUA_PHAN_LOAI',
      defenseFormatName: 'Chưa phân loại',
      rank: null,
      reviewerScore: null,
      gvhdScore: null,
    };
  }

  async schedules(semesterId?: string) {
    const list = await this.prisma.defenseSchedule.findMany({
      where: semesterId ? { semesterId } : undefined,
      include: {
        group: {
          include: {
            topic: {
              include: {
                owner: { select: { id: true, fullName: true, email: true } },
              },
            },
            members: { include: { student: { include: { user: { select: { fullName: true } } } } } },
            reviewerAssignments: {
              include: {
                lecturer: { include: { user: { select: { id: true, fullName: true, email: true } } } },
              },
            },
          },
        },
        committee: {
          include: { members: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    const classification = await this.getClassifiedDefenseFormats(semesterId).catch(() => null);
    const classMap = new Map((classification?.items || []).map((it: any) => [it.id, it]));

    return list.map((s) => {
      const classItem = classMap.get(s.groupId);
      const defenseFormat = classItem?.defenseFormat || (s.committeeId ? 'HOI_DONG' : 'POSTER');
      const defenseFormatName =
        classItem?.defenseFormatName ||
        (defenseFormat === 'HOI_DONG' ? 'Báo cáo Hội đồng (Top 20%)' : 'Báo cáo Poster (80%)');

      return {
        ...s,
        defenseFormat,
        defenseFormatName,
        reviewerScore: classItem?.reviewerScore ?? null,
        gvhdScore: classItem?.gvhdScore ?? null,
        rank: classItem?.rank ?? null,
      };
    });
  }


  async assignments() {
    return this.prisma.reviewerAssignment.findMany({
      include: {
        group: { include: { topic: true } },
        lecturer: { include: { user: { select: { fullName: true } } } },
      },
    });
  }

  async committees(departmentId?: string) {
    const list = await this.prisma.defenseCommittee.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
        NOT: [
          { name: { contains: '17' } },
          { name: { contains: 'Test' } },
        ],
      },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        schedules: true,
      },
      orderBy: { name: 'asc' },
    });

    // Deduplicate by name just in case
    const seenNames = new Set<string>();
    return list.filter((c) => {
      if (seenNames.has(c.name.trim().toLowerCase())) return false;
      seenNames.add(c.name.trim().toLowerCase());
      return true;
    });
  }

  async assignReviewer(userId: string, dto: AssignReviewerDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      include: {
        topic: { select: { ownerId: true, title: true } },
        members: { include: { student: { include: { user: true } } } },
        scores: { include: { criterion: true } },
      },
    });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');

    const lecturer = await this.prisma.lecturerProfile.findUnique({
      where: { id: dto.lecturerId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!lecturer) throw new NotFoundException('Không tìm thấy giảng viên');

    if (group.topic?.ownerId === lecturer.userId) {
      throw new BadRequestException('Không thể phân công GVHD làm phản biện cho chính nhóm này');
    }

    if (group.midtermStatus !== 'CONTINUE') {
      throw new BadRequestException('Chỉ nhóm được xác nhận CHO_LAM_TIEP ở giữa kỳ mới được phân công phản biện');
    }

    // Ràng buộc: Điểm của GVHD >= 6.0 mới được phản biện
    const gvhdScore = this.calculateGvhdScore(group.topic?.ownerId, (group as any).scores);
    if (gvhdScore === null) {
      throw new BadRequestException(
        `Nhóm ${group.code || ''} chưa có điểm đánh giá từ Giảng viên hướng dẫn. Theo quy định, điểm của GVHD phải >= 6.0 mới được phản biện.`,
      );
    }
    if (gvhdScore < 6.0) {
      throw new BadRequestException(
        `Điểm đánh giá của GVHD là ${gvhdScore} (< 6.0). Nhóm không đủ điều kiện phân công phản biện (yêu cầu điểm GVHD >= 6.0).`,
      );
    }

    const result = await this.prisma.reviewerAssignment.upsert({
      where: { groupId_lecturerId: { groupId: dto.groupId, lecturerId: dto.lecturerId } },
      update: { type: dto.type ?? 'PRIMARY', assignedBy: userId },
      create: {
        groupId: dto.groupId,
        lecturerId: dto.lecturerId,
        type: dto.type ?? 'PRIMARY',
        assignedBy: userId,
      },
    });

    const topicTitle = group.topic?.title || group.name;
    const reviewerRole = dto.type === AssignmentType.ADDITIONAL ? 'Phản biện phụ' : 'Phản biện chính';

    // 1. Gửi thông báo tới Giảng viên phản biện được phân công
    if (lecturer.userId) {
      await this.notifications.create({
        userId: lecturer.userId,
        title: 'Phân công phản biện Khóa luận tốt nghiệp',
        content: `Bạn đã được phân công làm Giảng viên phản biện (${reviewerRole}) cho đề tài "${topicTitle}".`,
        type: 'DEFENSE',
        data: { groupId: dto.groupId, reviewerId: dto.lecturerId, type: dto.type },
        sendEmail: true,
      });
    }

    // 2. Gửi thông báo tới sinh viên trong nhóm
    for (const member of group.members) {
      const studentUserId = member.student?.user?.id;
      if (studentUserId) {
        await this.notifications.create({
          userId: studentUserId,
          title: 'Phân công Giảng viên phản biện KLTN',
          content: `Đề tài "${topicTitle}" của nhóm đã được phân công Giảng viên phản biện: ${lecturer.user?.fullName || 'Thầy/Cô'} (${reviewerRole}).`,
          type: 'DEFENSE',
          data: {
            groupId: dto.groupId,
            reviewerId: dto.lecturerId,
            lecturerName: lecturer.user?.fullName,
          },
          sendEmail: true,
        });
      }
    }

    return result;
  }

  async assignTwoReviewers(userId: string, dto: AssignReviewersDto) {
    if (!dto.reviewerIds || dto.reviewerIds.length !== 2) {
      throw new BadRequestException('Phải phân công đúng 2 giảng viên phản biện');
    }

    const [id1, id2] = dto.reviewerIds;
    if (id1 === id2) {
      throw new BadRequestException('Hai giảng viên phản biện không được trùng nhau');
    }

    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      include: {
        topic: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                lecturerProfile: { select: { id: true } },
              },
            },
          },
        },
        members: { include: { student: { include: { user: true } } } },
        scores: { include: { criterion: true } },
      },
    });

    if (!group) throw new NotFoundException('Không tìm thấy nhóm KLTN');

    if (group.midtermStatus !== 'CONTINUE') {
      throw new BadRequestException('Chỉ nhóm được xác nhận CHO_LAM_TIEP ở giữa kỳ mới được phân công phản biện');
    }

    // Ràng buộc: Điểm của GVHD >= 6.0 mới được phản biện
    const gvhdScore = this.calculateGvhdScore(group.topic?.ownerId, (group as any).scores);
    if (gvhdScore === null) {
      throw new BadRequestException(
        `Nhóm ${group.code} chưa có điểm đánh giá từ Giảng viên hướng dẫn. Theo quy định, điểm của GVHD phải >= 6.0 mới được phản biện.`,
      );
    }
    if (gvhdScore < 6.0) {
      throw new BadRequestException(
        `Điểm đánh giá của GVHD là ${gvhdScore} (< 6.0). Nhóm không đủ điều kiện phân công phản biện (yêu cầu điểm GVHD >= 6.0).`,
      );
    }

    const findLecturer = async (id: string) => {
      return this.prisma.lecturerProfile.findFirst({
        where: {
          OR: [{ id }, { userId: id }],
        },
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
          quotas: { where: { semesterId: group.semesterId } },
        },
      });
    };

    const lecturer1 = await findLecturer(id1);
    const lecturer2 = await findLecturer(id2);

    if (!lecturer1 || !lecturer2) {
      throw new NotFoundException('Không tìm thấy một trong hai giảng viên phản biện được chọn');
    }

    if (lecturer1.id === lecturer2.id) {
      throw new BadRequestException('Hai giảng viên phản biện không được trùng nhau');
    }

    // Ngoại lệ: Trùng GVHD -> 400
    const advisorUserId = group.topic?.ownerId;
    const advisorLecturerId = group.topic?.owner?.lecturerProfile?.id;

    if (
      (advisorUserId && (lecturer1.userId === advisorUserId || lecturer2.userId === advisorUserId)) ||
      (advisorLecturerId && (lecturer1.id === advisorLecturerId || lecturer2.id === advisorLecturerId))
    ) {
      throw new BadRequestException('Không thể phân công GVHD làm phản biện cho chính nhóm này (Trùng GVHD)');
    }

    // Kiểm tra trạng thái hoạt động của giảng viên
    if (lecturer1.user?.status !== 'ACTIVE' || lecturer2.user?.status !== 'ACTIVE') {
      throw new BadRequestException('Giảng viên phản biện phải ở trạng thái ACTIVE');
    }

    // Kiểm tra định mức tải (Load check)
    const maxReviewConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'MAX_REVIEW_GROUPS', semesterId: group.semesterId },
    });
    const defaultMax = typeof maxReviewConfig?.value === 'number' ? maxReviewConfig.value : 5;

    for (const lec of [lecturer1, lecturer2]) {
      const currentLoad = await this.prisma.reviewerAssignment.count({
        where: {
          lecturerId: lec.id,
          groupId: { not: group.id },
          group: {
            semesterId: group.semesterId,
            status: { not: 'CANCELLED' },
          },
        },
      });
      const maxGroups = lec.quotas[0]?.maxGroups ?? defaultMax;
      if (currentLoad >= maxGroups) {
        throw new BadRequestException(
          `Giảng viên ${lec.user?.fullName} đã đạt định mức phản biện tối đa (${currentLoad}/${maxGroups} nhóm). Không thể nhận thêm.`,
        );
      }
    }

    // Thực hiện phân công trong Transaction
    const assignments = await this.prisma.$transaction(async (tx) => {
      await tx.reviewerAssignment.deleteMany({
        where: { groupId: dto.groupId },
      });

      const a1 = await tx.reviewerAssignment.create({
        data: {
          groupId: dto.groupId,
          lecturerId: lecturer1.id,
          type: AssignmentType.PRIMARY,
          assignedBy: userId,
        },
        include: {
          lecturer: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        },
      });

      const a2 = await tx.reviewerAssignment.create({
        data: {
          groupId: dto.groupId,
          lecturerId: lecturer2.id,
          type: AssignmentType.ADDITIONAL,
          assignedBy: userId,
        },
        include: {
          lecturer: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        },
      });

      return [a1, a2];
    });

    const topicTitle = group.topic?.title || group.name;

    // Gửi thông báo đến 2 GVPB
    if (lecturer1.userId) {
      await this.notifications.create({
        userId: lecturer1.userId,
        title: 'Phân công phản biện KLTN (GVPB 1 - Phản biện chính)',
        content: `Bạn đã được phân công làm Giảng viên phản biện chính (GVPB 1) cho đề tài "${topicTitle}". Đồng phản biện: ${lecturer2.user?.fullName}.`,
        type: 'DEFENSE',
        data: { groupId: dto.groupId, reviewerId: lecturer1.id, type: AssignmentType.PRIMARY },
        sendEmail: true,
      });
    }

    if (lecturer2.userId) {
      await this.notifications.create({
        userId: lecturer2.userId,
        title: 'Phân công phản biện KLTN (GVPB 2 - Phản biện phụ)',
        content: `Bạn đã được phân công làm Giảng viên phản biện (GVPB 2) cho đề tài "${topicTitle}". Đồng phản biện: ${lecturer1.user?.fullName}.`,
        type: 'DEFENSE',
        data: { groupId: dto.groupId, reviewerId: lecturer2.id, type: AssignmentType.ADDITIONAL },
        sendEmail: true,
      });
    }

    // Gửi thông báo đến sinh viên trong nhóm
    for (const member of group.members) {
      const studentUserId = member.student?.user?.id;
      if (studentUserId) {
        await this.notifications.create({
          userId: studentUserId,
          title: 'Phân công 2 Giảng viên phản biện KLTN',
          content: `Đề tài "${topicTitle}" của nhóm đã được phân công 2 Giảng viên phản biện: GVPB 1: ${lecturer1.user?.fullName || 'Thầy/Cô'} và GVPB 2: ${lecturer2.user?.fullName || 'Thầy/Cô'}.`,
          type: 'DEFENSE',
          data: {
            groupId: dto.groupId,
            reviewer1: { id: lecturer1.id, name: lecturer1.user?.fullName },
            reviewer2: { id: lecturer2.id, name: lecturer2.user?.fullName },
          },
          sendEmail: true,
        });
      }
    }

    return {
      message: 'Phân công 2 Giảng viên phản biện thành công',
      groupId: group.id,
      groupCode: group.code,
      topicTitle,
      assignments: assignments.map((a) => ({
        id: a.id,
        lecturerId: a.lecturerId,
        lecturerName: a.lecturer.user?.fullName,
        type: a.type,
        assignedAt: a.assignedAt,
      })),
    };
  }

  /**
   * Phân công Giảng viên phản biện thứ 3 (GVPB 3)
   * Ràng buộc:
   * - Điểm giữa 2 GVPB chênh nhau >= 4 điểm HOẶC điểm của GVPB và GVHD chênh nhau >= 2 điểm.
   * - Nhóm đã có ít nhất 2 GVPB.
   * - GVPB 3 không được trùng GVHD và không được trùng GVPB 1, GVPB 2.
   * - Kiểm tra định mức tải (quotas) của GVPB 3.
   * - Khi đó điểm GVPB là trung bình cộng của cả 3 GVPB.
   */
  async assignThirdReviewer(userId: string, dto: AssignThirdReviewerDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      include: {
        topic: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                lecturerProfile: { select: { id: true } },
              },
            },
          },
        },
        members: { include: { student: { include: { user: true } } } },
        scores: { include: { criterion: true } },
        reviewerAssignments: {
          include: {
            lecturer: {
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });

    if (!group) throw new NotFoundException('Không tìm thấy nhóm KLTN');

    if (group.midtermStatus !== 'CONTINUE') {
      throw new BadRequestException('Chỉ nhóm được xác nhận CHO_LAM_TIEP ở giữa kỳ mới được phân công phản biện');
    }

    if (group.reviewerAssignments.length < 2) {
      throw new BadRequestException('Nhóm phải có tối thiểu 2 Giảng viên phản biện trước khi phân công GVPB thứ 3');
    }

    // Kiểm tra điều kiện lệch điểm (Rule: |GVPB1 - GVPB2| >= 4đ HOẶC |GVPB - GVHD| >= 2đ)
    const gvhdScore = this.calculateGvhdScore(group.topic?.ownerId, (group as any).scores);
    const revResult = this.calculateReviewerScore(group.reviewerAssignments, group.scores, gvhdScore);

    if (!revResult.hasDiscrepancy && group.reviewerAssignments.length < 3) {
      throw new BadRequestException(
        'Không thỏa điều kiện phân công GVPB thứ 3: Chỉ phân công GVPB thứ 3 khi điểm giữa 2 GVPB chênh lệch >= 4.0 điểm hoặc điểm của GVPB và GVHD chênh lệch >= 2.0 điểm.',
      );
    }

    const lecturer3 = await this.prisma.lecturerProfile.findFirst({
      where: {
        OR: [{ id: dto.reviewerId }, { userId: dto.reviewerId }],
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
        quotas: { where: { semesterId: group.semesterId } },
      },
    });

    if (!lecturer3) {
      throw new NotFoundException('Không tìm thấy giảng viên phản biện thứ 3');
    }

    if (lecturer3.user?.status !== 'ACTIVE') {
      throw new BadRequestException('Giảng viên phản biện thứ 3 phải ở trạng thái ACTIVE');
    }

    // Ngoại lệ: Trùng GVHD -> 400
    const advisorUserId = group.topic?.ownerId;
    const advisorLecturerId = group.topic?.owner?.lecturerProfile?.id;
    if (
      (advisorUserId && lecturer3.userId === advisorUserId) ||
      (advisorLecturerId && lecturer3.id === advisorLecturerId)
    ) {
      throw new BadRequestException('Không thể phân công GVHD làm Giảng viên phản biện thứ 3 (Trùng GVHD)');
    }

    // Ngoại lệ: Trùng GVPB 1 hoặc GVPB 2 -> 400
    const rev1 = group.reviewerAssignments[0];
    const rev2 = group.reviewerAssignments[1];
    if (
      lecturer3.id === rev1.lecturerId ||
      lecturer3.userId === rev1.lecturer?.userId ||
      lecturer3.id === rev2.lecturerId ||
      lecturer3.userId === rev2.lecturer?.userId
    ) {
      throw new BadRequestException('Giảng viên phản biện thứ 3 không được trùng với GVPB 1 hoặc GVPB 2 đã phân công');
    }

    // Kiểm tra định mức tải
    const maxReviewConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'MAX_REVIEW_GROUPS', semesterId: group.semesterId },
    });
    const defaultMax = typeof maxReviewConfig?.value === 'number' ? maxReviewConfig.value : 5;
    const currentLoad = await this.prisma.reviewerAssignment.count({
      where: {
        lecturerId: lecturer3.id,
        groupId: { not: group.id },
        group: {
          semesterId: group.semesterId,
          status: { not: 'CANCELLED' },
        },
      },
    });
    const maxGroups = lecturer3.quotas[0]?.maxGroups ?? defaultMax;
    if (currentLoad >= maxGroups) {
      throw new BadRequestException(
        `Giảng viên ${lecturer3.user?.fullName} đã đạt định mức phản biện tối đa (${currentLoad}/${maxGroups} nhóm). Không thể nhận thêm.`,
      );
    }

    // Thực hiện lưu GVPB 3 trong Transaction
    const assignment3 = await this.prisma.$transaction(async (tx) => {
      // Nếu nhóm đã có >= 3 reviewer (đang đổi GVPB 3), xóa reviewer thứ 3 cũ nếu khác lecturer3
      if (group.reviewerAssignments.length >= 3) {
        const oldThird = group.reviewerAssignments[2];
        if (oldThird.lecturerId !== lecturer3.id) {
          await tx.reviewerAssignment.delete({
            where: { id: oldThird.id },
          });
        }
      }

      return tx.reviewerAssignment.upsert({
        where: {
          groupId_lecturerId: {
            groupId: dto.groupId,
            lecturerId: lecturer3.id,
          },
        },
        update: {
          assignedBy: userId,
          type: AssignmentType.ADDITIONAL,
        },
        create: {
          groupId: dto.groupId,
          lecturerId: lecturer3.id,
          type: AssignmentType.ADDITIONAL,
          assignedBy: userId,
        },
        include: {
          lecturer: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      });
    });

    const topicTitle = group.topic?.title || group.name;

    // Gửi thông báo đến GVPB 3
    if (lecturer3.userId) {
      await this.notifications.create({
        userId: lecturer3.userId,
        title: 'Phân công phản biện KLTN (GVPB 3 - Thẩm định do lệch điểm)',
        content: `Bạn đã được Trưởng bộ môn phân công làm Giảng viên phản biện thứ 3 (thẩm định lệch điểm) cho đề tài "${topicTitle}". Đồng phản biện: ${rev1.lecturer?.user?.fullName || 'GVPB 1'}, ${rev2.lecturer?.user?.fullName || 'GVPB 2'}.`,
        type: 'DEFENSE',
        data: { groupId: dto.groupId, reviewerId: lecturer3.id, isThirdReviewer: true },
        sendEmail: true,
      });
    }

    // Gửi thông báo đến sinh viên trong nhóm
    for (const member of group.members) {
      const studentUserId = member.student?.user?.id;
      if (studentUserId) {
        await this.notifications.create({
          userId: studentUserId,
          title: 'Phân công Giảng viên phản biện thứ 3 (GVPB 3)',
          content: `Đề tài "${topicTitle}" của nhóm đã được phân công thêm Giảng viên phản biện thứ 3: ${lecturer3.user?.fullName} do có chênh lệch điểm đánh giá. Điểm phản biện cuối cùng sẽ là trung bình cộng của 3 GVPB.`,
          type: 'DEFENSE',
          data: {
            groupId: dto.groupId,
            reviewer3: { id: lecturer3.id, name: lecturer3.user?.fullName },
          },
          sendEmail: true,
        });
      }
    }

    // Gửi thông báo đến GVHD
    if (advisorUserId) {
      await this.notifications.create({
        userId: advisorUserId,
        title: 'Phân công GVPB thứ 3 cho nhóm hướng dẫn',
        content: `Nhóm "${group.code} - ${topicTitle}" đã được Trưởng bộ môn phân công thêm Giảng viên phản biện thứ 3: ${lecturer3.user?.fullName} do có chênh lệch điểm. Điểm phản biện sẽ là trung bình cộng của 3 GVPB.`,
        type: 'DEFENSE',
        data: { groupId: dto.groupId, reviewer3Id: lecturer3.id },
      });
    }

    return {
      message: 'Phân công Giảng viên phản biện thứ 3 thành công. Điểm phản biện sẽ được tính bằng trung bình cộng của 3 GVPB.',
      groupId: group.id,
      groupCode: group.code,
      topicTitle,
      thirdReviewer: {
        id: assignment3.id,
        lecturerId: lecturer3.id,
        lecturerName: lecturer3.user?.fullName,
        email: lecturer3.user?.email,
      },
      discrepancyReasons: revResult.discrepancyReasons,
    };
  }

  /**
   * Hủy phân công Giảng viên phản biện thứ 3
   */
  async removeThirdReviewer(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        reviewerAssignments: {
          orderBy: { assignedAt: 'asc' },
        },
      },
    });

    if (!group) throw new NotFoundException('Không tìm thấy nhóm KLTN');
    if (group.reviewerAssignments.length < 3) {
      throw new BadRequestException('Nhóm chưa có GVPB thứ 3 để hủy');
    }

    const thirdAssignment = group.reviewerAssignments[2];
    await this.prisma.reviewerAssignment.delete({
      where: { id: thirdAssignment.id },
    });

    return {
      message: 'Đã hủy phân công Giảng viên phản biện thứ 3 thành công',
      groupId,
    };
  }

  async createCommittee(dto: CreateCommitteeDto) {
    return this.prisma.defenseCommittee.create({
      data: {
        name: dto.name,
        departmentId: dto.departmentId,
        members: {
          create: dto.memberIds.map((userId, index) => ({
            userId,
            role: index === 0 ? 'Chủ tịch' : 'Thành viên',
          })),
        },
      },
      include: {
        members: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });
  }

  async createDefenseCommittee(userId: string, dto: CreateDefenseCommitteeDto) {
    const semester = await this.prisma.semester.findUnique({
      where: { id: dto.semesterId },
      include: { department: true },
    });
    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    // 1. Kiểm tra số lượng thành viên tối thiểu
    const minConfig = await this.prisma.systemConfig.findFirst({
      where: { key: 'MIN_COMMITTEE_MEMBERS', semesterId: dto.semesterId },
    });
    const minMembers = typeof minConfig?.value === 'number' ? minConfig.value : 3;
    if (!dto.memberIds || dto.memberIds.length < minMembers) {
      throw new BadRequestException(
        `Hội đồng bảo vệ phải có tối thiểu ${minMembers} thành viên (Chủ tịch, Thư ký, Ủy viên)`,
      );
    }

    // Kiểm tra trùng lặp ID thành viên
    const uniqueMemberIds = new Set(dto.memberIds);
    if (uniqueMemberIds.size !== dto.memberIds.length) {
      throw new BadRequestException('Danh sách thành viên hội đồng không được chứa người trùng nhau');
    }

    // Resolve thông tin tất cả các thành viên (hỗ trợ cả userId hoặc lecturerProfileId)
    const resolvedMembers = await Promise.all(
      dto.memberIds.map(async (mId) => {
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [{ id: mId }, { lecturerProfile: { id: mId } }],
          },
          include: { lecturerProfile: true },
        });
        if (!user) {
          throw new NotFoundException(`Không tìm thấy thành viên có ID: ${mId}`);
        }
        if (user.status !== 'ACTIVE') {
          throw new BadRequestException(`Thành viên ${user.fullName} đang không ở trạng thái ACTIVE`);
        }
        return user;
      }),
    );
    const memberUserIds = resolvedMembers.map((u) => u.id);
    const memberUserIdSet = new Set(memberUserIds);

    // 2. Kiểm tra danh sách nhóm và xung đột vai trò (Anti-conflict check)
    let groups: any[] = [];
    if (dto.groupIds && dto.groupIds.length > 0) {
      const uniqueGroupIds = Array.from(new Set(dto.groupIds));
      groups = await this.prisma.group.findMany({
        where: { id: { in: uniqueGroupIds } },
        include: {
          topic: {
            include: {
              owner: { select: { id: true, fullName: true, email: true } },
            },
          },
          scores: { include: { criterion: true } },
        },
      });

      if (groups.length !== uniqueGroupIds.length) {
        throw new NotFoundException('Một số nhóm KLTN không tồn tại trong hệ thống');
      }

      for (const group of groups) {
        if (group.semesterId !== dto.semesterId) {
          throw new BadRequestException(`Nhóm ${group.code} (${group.name}) không thuộc học kỳ này`);
        }

        if (group.midtermStatus !== 'CONTINUE') {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") chưa được xác nhận CHO_LAM_TIEP ở giữa kỳ`,
          );
        }

        // Ràng buộc: Điểm của GVHD >= 6.0 mới được ra hội đồng
        const gvhdScore = this.calculateGvhdScore(group.topic?.ownerId, (group as any).scores);
        if (gvhdScore === null) {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") chưa có điểm từ Giảng viên hướng dẫn. Yêu cầu điểm GVHD >= 6.0 mới được ra hội đồng bảo vệ.`,
          );
        }
        if (gvhdScore < 6.0) {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") có điểm GVHD là ${gvhdScore} (< 6.0), không đủ điều kiện ra hội đồng bảo vệ (yêu cầu điểm GVHD >= 6.0).`,
          );
        }

        // Ràng buộc phân luồng: Sau khi có điểm phản biện, 20% đề tài điểm cao nhất báo cáo Hội đồng, 80% còn lại báo cáo Poster
        const formatInfo = await this.getGroupDefenseFormat(group.id, dto.semesterId);
        if (formatInfo.defenseFormat === 'POSTER') {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") thuộc diện Báo cáo Poster (80% còn lại với điểm phản biện: ${formatInfo.reviewerScore ?? 'N/A'}), không được xếp vào Hội đồng bảo vệ trực tiếp. Theo quy định, chỉ 20% đề tài có điểm phản biện cao nhất mới được bảo vệ trước Hội đồng.`,
          );
        }
        if (formatInfo.defenseFormat === 'CHUA_PHAN_LOAI' || formatInfo.reviewerScore === null) {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") chưa có điểm từ Giảng viên phản biện. Theo quy định, sau khi có điểm phản biện mới phân luồng 20% đề tài có điểm cao nhất ra Hội đồng và 80% báo cáo Poster.`,
          );
        }

        // Kiểm tra không chấm nhóm mình hướng dẫn (Conflict check)
        const advisorUserId = group.topic?.ownerId;
        const advisorName = group.topic?.owner?.fullName || 'Giảng viên hướng dẫn';
        if (advisorUserId && memberUserIdSet.has(advisorUserId)) {
          const conflictingMember = resolvedMembers.find((m) => m.id === advisorUserId);
          throw new BadRequestException(
            `Xung đột vai trò: Giảng viên ${conflictingMember?.fullName || advisorName} là Giảng viên hướng dẫn của nhóm ${group.code} ("${group.topic?.title || group.name}"), không thể tham gia hội đồng chấm nhóm này!`,
          );
        }
      }
    }

    // 3. Tự động sinh tên hội đồng nếu để trống
    let committeeName = (dto.tenHoiDong || dto.name || '').trim();
    if (!committeeName) {
      const count = await this.prisma.defenseCommittee.count({
        where: { departmentId: semester.departmentId },
      });
      committeeName = `Hội đồng bảo vệ KLTN số ${count + 1} - ${semester.code}`;
    }

    // 4. Lưu hội đồng và liên kết các nhóm vào hội đồng trong Transaction
    const committee = await this.prisma.$transaction(async (tx) => {
      const newCommittee = await tx.defenseCommittee.create({
        data: {
          name: committeeName,
          departmentId: semester.departmentId,
          members: {
            create: memberUserIds.map((userId, index) => ({
              userId,
              role:
                index === 0
                  ? 'Chủ tịch'
                  : index === 1
                  ? 'Thư ký'
                  : index === 2
                  ? 'Ủy viên phản biện'
                  : 'Ủy viên',
            })),
          },
        },
        include: {
          members: {
            include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
          },
        },
      });

      // Liên kết các nhóm với Hội đồng qua DefenseSchedule
      if (groups.length > 0) {
        for (const group of groups) {
          const existingSchedule = await tx.defenseSchedule.findFirst({
            where: { groupId: group.id, semesterId: dto.semesterId },
          });

          if (existingSchedule) {
            await tx.defenseSchedule.update({
              where: { id: existingSchedule.id },
              data: { committeeId: newCommittee.id },
            });
          } else {
            const startsAt = semester.defenseFrom ?? new Date();
            const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
            await tx.defenseSchedule.create({
              data: {
                groupId: group.id,
                semesterId: dto.semesterId,
                committeeId: newCommittee.id,
                status: 'DRAFT',
                startsAt,
                endsAt,
              },
            });
          }
        }
      }

      return newCommittee;
    });

    // 5. Gửi thông báo đến thành viên hội đồng
    for (const m of committee.members) {
      await this.notifications.create({
        userId: m.userId,
        title: 'Quyết định thành lập Hội đồng bảo vệ KLTN',
        content: `Bạn được phân công tham gia "${committee.name}" với vai trò ${m.role}. Hội đồng phụ trách chấm ${groups.length} nhóm đề tài KLTN.`,
        type: 'DEFENSE',
        data: { committeeId: committee.id, role: m.role, groupCount: groups.length },
        sendEmail: true,
      });
    }

    // 6. Gửi thông báo đến sinh viên trong các nhóm được chấm
    for (const group of groups) {
      const groupMembers = await this.prisma.groupMember.findMany({
        where: { groupId: group.id },
        include: { student: { include: { user: true } } },
      });
      for (const gm of groupMembers) {
        const studentUserId = gm.student?.user?.id;
        if (studentUserId) {
          await this.notifications.create({
            userId: studentUserId,
            title: 'Phân công Hội đồng bảo vệ Khóa luận tốt nghiệp',
            content: `Nhóm đề tài "${group.topic?.title || group.name}" của bạn đã được phân công vào "${committee.name}".`,
            type: 'DEFENSE',
            data: { committeeId: committee.id, groupId: group.id },
            sendEmail: true,
          });
        }
      }
    }

    return {
      message: 'Thành lập Hội đồng bảo vệ KLTN thành công',
      id: committee.id,
      name: committee.name,
      departmentId: committee.departmentId,
      semesterId: dto.semesterId,
      members: committee.members.map((m) => ({
        userId: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        role: m.role,
      })),
      assignedGroups: groups.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        topicTitle: g.topic?.title,
        advisorName: g.topic?.owner?.fullName,
      })),
      groupCount: groups.length,
    };
  }

  async getAvailableCommitteeMembers(semesterId: string, groupIds?: string[]) {
    const semester = await this.prisma.semester.findUnique({
      where: { id: semesterId },
      include: { department: true },
    });
    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    const advisorUserIds = new Set<string>();
    const advisorMap = new Map<string, string>();

    if (groupIds && groupIds.length > 0) {
      const groups = await this.prisma.group.findMany({
        where: { id: { in: groupIds } },
        include: { topic: { include: { owner: true } } },
      });
      for (const g of groups) {
        if (g.topic?.ownerId) {
          advisorUserIds.add(g.topic.ownerId);
          advisorMap.set(g.topic.ownerId, g.code);
        }
      }
    }

    const lecturers = await this.prisma.lecturerProfile.findMany({
      where: {
        departmentId: semester.departmentId,
        user: { status: 'ACTIVE' },
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ user: { fullName: 'asc' } }],
    });

    const seenEmails = new Set<string>();
    const seenNames = new Set<string>();

    const filteredLecturers = lecturers.filter((lec) => {
      const email = lec.user?.email?.toLowerCase() || '';
      const code = (lec.lecturerCode || '').toUpperCase();
      const fullName = (lec.user?.fullName || '').trim().toLowerCase();

      if (
        !email ||
        seenEmails.has(email) ||
        code.endsWith('_ALT') ||
        code.includes('TBM001_ALT') ||
        code.startsWith('HOD_') ||
        code.startsWith('GV_UL_') ||
        code.startsWith('GV_SC_') ||
        code.startsWith('GVA_') ||
        code.startsWith('GVB_') ||
        email.includes('truongbomôn') ||
        email.startsWith('hod_') ||
        email.includes('_ul_') ||
        email.includes('_sc_') ||
        /\d{10,}@kltn\.edu\.vn/.test(email) ||
        email.includes('_score_') ||
        email.includes('_unlock_') ||
        email.startsWith('gv_b_') ||
        email.startsWith('gv_a_') ||
        email.startsWith('test_')
      ) {
        return false;
      }

      if (fullName && seenNames.has(fullName)) {
        return false;
      }

      seenEmails.add(email);
      if (fullName) seenNames.add(fullName);
      return true;
    });

    return filteredLecturers.map((lec) => {
      const isAdvisorOfSelectedGroup = advisorUserIds.has(lec.userId);
      const groupCode = isAdvisorOfSelectedGroup ? advisorMap.get(lec.userId) : null;
      const isEligible = !isAdvisorOfSelectedGroup;
      const reason = isAdvisorOfSelectedGroup
        ? `Là GVHD của nhóm ${groupCode} (xung đột vai trò - không được chấm nhóm mình hướng dẫn)`
        : null;

      return {
        id: lec.id,
        userId: lec.userId,
        lecturerCode: lec.lecturerCode,
        fullName: lec.user?.fullName || '',
        email: lec.user?.email || '',
        title: lec.title || 'Giảng viên',
        department: lec.department,
        isEligible,
        isAdvisorOfSelectedGroup,
        reason,
      };
    });
  }

  async listDefenseCommittees(semesterId?: string) {
    const where: any = {};
    if (semesterId) {
      const semester = await this.prisma.semester.findUnique({
        where: { id: semesterId },
        select: { departmentId: true },
      });
      if (semester?.departmentId) {
        where.departmentId = semester.departmentId;
      }
    }

    const committees = await this.prisma.defenseCommittee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
          },
          orderBy: { role: 'asc' },
        },
        schedules: {
          where: semesterId ? { semesterId } : undefined,
          include: {
            group: {
              include: {
                topic: {
                  include: {
                    owner: { select: { id: true, fullName: true, email: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return committees.map((c) => ({
      id: c.id,
      name: c.name,
      departmentId: c.departmentId,
      department: c.department,
      members: c.members.map((m) => ({
        userId: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        phone: m.user.phone,
        role: m.role,
      })),
      assignedGroups: c.schedules
        .filter((s) => s.group)
        .map((s) => ({
          id: s.group.id,
          code: s.group.code,
          name: s.group.name,
          topicTitle: s.group.topic?.title,
          advisorName: s.group.topic?.owner?.fullName,
          room: s.room,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          status: s.status,
        })),
      groupCount: c.schedules.filter((s) => s.group).length,
    }));
  }

  /**
   * Phân các nhóm đề tài cho một Hội đồng bảo vệ KLTN đã chọn
   * Sau khi hội đồng được thành lập, trưởng bộ môn chọn hội đồng và phân các nhóm cho hội đồng đó.
   * Tự động kiểm tra xung đột vai trò GVHD và các điều kiện bảo vệ.
   */
  async assignGroupsToCommittee(
    userId: string,
    committeeId: string,
    dto: AssignGroupsToCommitteeDto,
  ) {
    // 1. Kiểm tra Hội đồng bảo vệ
    const committee = await this.prisma.defenseCommittee.findUnique({
      where: { id: committeeId },
      include: {
        department: true,
        members: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    if (!committee) {
      throw new NotFoundException('Không tìm thấy hội đồng bảo vệ');
    }

    // 2. Kiểm tra học kỳ
    const semester = await this.prisma.semester.findUnique({
      where: { id: dto.semesterId },
    });
    if (!semester) {
      throw new NotFoundException('Không tìm thấy thông tin học kỳ');
    }

    const memberUserIdSet = new Set<string>(committee.members.map((m) => m.userId));
    const memberNameMap = new Map<string, string>(
      committee.members.map((m) => [m.userId, `${m.user?.fullName || 'Giảng viên'} (${m.role})`]),
    );

    // 3. Kiểm tra danh sách nhóm đề tài và các ràng buộc
    const groupIds = dto.groupIds ? Array.from(new Set(dto.groupIds)) : [];
    let groups: any[] = [];

    if (groupIds.length > 0) {
      groups = await this.prisma.group.findMany({
        where: { id: { in: groupIds } },
        include: {
          topic: {
            include: {
              owner: { select: { id: true, fullName: true, email: true } },
            },
          },
          scores: {
            include: {
              criterion: true,
            },
          },
        },
      });

      if (groups.length !== groupIds.length) {
        throw new NotFoundException('Một hoặc nhiều nhóm đề tài không tồn tại trong hệ thống');
      }

      for (const group of groups) {
        if (group.semesterId !== dto.semesterId) {
          throw new BadRequestException(`Nhóm ${group.code} (${group.name}) không thuộc học kỳ này`);
        }

        if (group.midtermStatus !== 'CONTINUE') {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") chưa được xác nhận CHO_LAM_TIEP ở giữa kỳ`,
          );
        }

        // Ràng buộc: Điểm của GVHD >= 6.0 mới được ra hội đồng
        const gvhdScore = this.calculateGvhdScore(group.topic?.ownerId, (group as any).scores);
        if (gvhdScore === null) {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") chưa có điểm từ Giảng viên hướng dẫn. Yêu cầu điểm GVHD >= 6.0 mới được ra hội đồng bảo vệ.`,
          );
        }
        if (gvhdScore < 6.0) {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") có điểm GVHD là ${gvhdScore} (< 6.0), không đủ điều kiện ra hội đồng bảo vệ (yêu cầu điểm GVHD >= 6.0).`,
          );
        }

        // Ràng buộc phân luồng: Không được là POSTER
        const formatInfo = await this.getGroupDefenseFormat(group.id, dto.semesterId);
        if (formatInfo.defenseFormat === 'POSTER') {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") thuộc diện Báo cáo Poster (80% còn lại với điểm phản biện: ${formatInfo.reviewerScore ?? 'N/A'}), không được xếp vào Hội đồng bảo vệ trực tiếp. Theo quy định, chỉ 20% đề tài có điểm phản biện cao nhất mới được bảo vệ trước Hội đồng.`,
          );
        }
        if (formatInfo.defenseFormat === 'CHUA_PHAN_LOAI' || formatInfo.reviewerScore === null) {
          throw new BadRequestException(
            `Nhóm ${group.code} ("${group.topic?.title || group.name}") chưa có điểm từ Giảng viên phản biện. Theo quy định, sau khi có điểm phản biện mới phân luồng 20% đề tài có điểm cao nhất ra Hội đồng và 80% báo cáo Poster.`,
          );
        }

        // Ràng buộc chống xung đột vai trò: GVHD KHÔNG ĐƯỢC là thành viên hội đồng
        const advisorUserId = group.topic?.ownerId;
        if (advisorUserId && memberUserIdSet.has(advisorUserId)) {
          const conflictMemberDesc = memberNameMap.get(advisorUserId) || 'Thành viên hội đồng';
          throw new BadRequestException(
            `Xung đột vai trò: ${conflictMemberDesc} là Giảng viên hướng dẫn của nhóm ${group.code} ("${group.topic?.title || group.name}"), không thể tham gia hội đồng chấm nhóm này!`,
          );
        }
      }
    }

    // 4. Cập nhật các lịch bảo vệ và liên kết nhóm vào Hội đồng trong Transaction
    await this.prisma.$transaction(async (tx) => {
      // Tìm các schedule hiện tại của hội đồng này trong học kỳ này
      const currentSchedules = await tx.defenseSchedule.findMany({
        where: { committeeId: committee.id, semesterId: dto.semesterId },
      });

      // Các nhóm bị bỏ chọn khỏi hội đồng này -> gỡ committeeId (set null)
      const removedSchedules = currentSchedules.filter((s) => !groupIds.includes(s.groupId));
      for (const rem of removedSchedules) {
        await tx.defenseSchedule.update({
          where: { id: rem.id },
          data: { committeeId: null },
        });
      }

      // Các nhóm được gán vào hội đồng này
      for (const group of groups) {
        const existingSchedule = await tx.defenseSchedule.findFirst({
          where: { groupId: group.id, semesterId: dto.semesterId },
        });

        if (existingSchedule) {
          await tx.defenseSchedule.update({
            where: { id: existingSchedule.id },
            data: { committeeId: committee.id },
          });
        } else {
          const startsAt = semester.defenseFrom ?? new Date();
          const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
          await tx.defenseSchedule.create({
            data: {
              groupId: group.id,
              semesterId: dto.semesterId,
              committeeId: committee.id,
              status: 'DRAFT',
              startsAt,
              endsAt,
            },
          });
        }
      }
    });

    // 5. Gửi thông báo đến thành viên hội đồng
    for (const m of committee.members) {
      await this.notifications.create({
        userId: m.userId,
        title: 'Cập nhật phân công nhóm cho Hội đồng bảo vệ KLTN',
        content: `Hội đồng "${committee.name}" vừa được phân công phụ trách ${groups.length} nhóm đề tài KLTN.`,
        type: 'DEFENSE',
        data: { committeeId: committee.id, role: m.role, groupCount: groups.length },
        sendEmail: true,
      });
    }

    // 6. Gửi thông báo đến sinh viên các nhóm được phân công
    for (const group of groups) {
      const groupMembers = await this.prisma.groupMember.findMany({
        where: { groupId: group.id },
        include: { student: { include: { user: true } } },
      });
      for (const gm of groupMembers) {
        const studentUserId = gm.student?.user?.id;
        if (studentUserId) {
          await this.notifications.create({
            userId: studentUserId,
            title: 'Phân công Hội đồng bảo vệ Khóa luận tốt nghiệp',
            content: `Nhóm đề tài "${group.topic?.title || group.name}" của bạn đã được phân công vào "${committee.name}".`,
            type: 'DEFENSE',
            data: { committeeId: committee.id, groupId: group.id },
            sendEmail: true,
          });
        }
      }
    }

    return {
      message: `Phân công ${groups.length} nhóm cho Hội đồng "${committee.name}" thành công`,
      committeeId: committee.id,
      committeeName: committee.name,
      groupCount: groups.length,
      assignedGroups: groups.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        topicTitle: g.topic?.title,
        advisorName: g.topic?.owner?.fullName,
      })),
    };
  }

  /**
   * Xóa một Hội đồng bảo vệ KLTN
   */
  async deleteDefenseCommittee(userId: string, committeeId: string) {
    const committee = await this.prisma.defenseCommittee.findUnique({
      where: { id: committeeId },
    });
    if (!committee) {
      throw new NotFoundException('Không tìm thấy hội đồng bảo vệ');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.defenseSchedule.updateMany({
        where: { committeeId },
        data: { committeeId: null },
      });
      await tx.defenseCommitteeMember.deleteMany({
        where: { committeeId },
      });
      await tx.defenseCommittee.delete({
        where: { id: committeeId },
      });
    });

    return { message: 'Xóa hội đồng bảo vệ thành công', id: committeeId };
  }

  async createSchedule(dto: CreateScheduleDto) {
    return this.scheduleDefense('system', dto);
  }

  async scheduleDefense(userId: string, dto: ScheduleDefenseDto) {
    const rawStartsAt = dto.startsAt || dto.ngayGio;
    if (!rawStartsAt) {
      throw new BadRequestException('Vui lòng cung cấp thời gian bảo vệ (ngayGio hoặc startsAt)');
    }

    const startDateTime = new Date(rawStartsAt);
    if (isNaN(startDateTime.getTime())) {
      throw new BadRequestException('Thời gian bắt đầu không hợp lệ');
    }

    let endDateTime: Date;
    if (dto.endsAt) {
      endDateTime = new Date(dto.endsAt);
      if (isNaN(endDateTime.getTime())) {
        throw new BadRequestException('Thời gian kết thúc không hợp lệ');
      }
    } else {
      const duration = dto.durationMinutes && dto.durationMinutes > 0 ? dto.durationMinutes : 60;
      endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
    }

    if (endDateTime <= startDateTime) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }

    const room = (dto.room || dto.phongId || '').trim();
    if (!room) {
      throw new BadRequestException('Vui lòng cung cấp thông tin phòng bảo vệ (room hoặc phongId)');
    }

    if (!dto.committeeId && !dto.groupId && (!dto.groupIds || dto.groupIds.length === 0)) {
      throw new BadRequestException('Vui lòng cung cấp committeeId hoặc groupId để xếp lịch bảo vệ');
    }

    let committee: any = null;
    let committeeId = dto.committeeId;

    let targetGroupIds: string[] = [];
    if (dto.groupId) {
      targetGroupIds = [dto.groupId];
    } else if (dto.groupIds && dto.groupIds.length > 0) {
      targetGroupIds = Array.from(new Set(dto.groupIds));
    }

    if (committeeId) {
      committee = await this.prisma.defenseCommittee.findUnique({
        where: { id: committeeId },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
          department: true,
          schedules: {
            where: { status: { not: 'CANCELLED' } },
            include: { group: true },
          },
        },
      });
      if (!committee) {
        throw new NotFoundException(`Không tìm thấy Hội đồng bảo vệ có ID: ${committeeId}`);
      }

      if (targetGroupIds.length === 0) {
        const assignedGroupIds = committee.schedules
          .map((s: any) => s.groupId)
          .filter(Boolean);
        targetGroupIds = Array.from(new Set(assignedGroupIds));
        if (targetGroupIds.length === 0) {
          throw new BadRequestException(
            `Hội đồng "${committee.name}" hiện chưa được phân công nhóm nào. Vui lòng chọn nhóm bảo vệ.`,
          );
        }
      }
    }

    const groups = await this.prisma.group.findMany({
      where: { id: { in: targetGroupIds } },
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
        defenses: {
          where: { status: { not: 'CANCELLED' } },
          include: { committee: { include: { members: { include: { user: true } } } } },
        },
        scores: { include: { criterion: true } },
      },
    });

    if (groups.length !== targetGroupIds.length) {
      throw new NotFoundException('Một hoặc nhiều nhóm KLTN không tồn tại');
    }

    for (const g of groups) {
      if (g.midtermStatus !== 'CONTINUE') {
        throw new BadRequestException(
          `Nhóm ${g.code} chưa được xác nhận CHO_LAM_TIEP ở giữa kỳ, không đủ điều kiện xếp lịch bảo vệ`,
        );
      }

      // Ràng buộc: Điểm của GVHD >= 6.0 mới được ra hội đồng
      const gvhdScore = this.calculateGvhdScore(g.topic?.ownerId, (g as any).scores);
      if (gvhdScore === null) {
        throw new BadRequestException(
          `Nhóm ${g.code} chưa có điểm từ Giảng viên hướng dẫn. Yêu cầu điểm GVHD >= 6.0 mới được xếp lịch ra hội đồng bảo vệ.`,
        );
      }
      if (gvhdScore < 6.0) {
        throw new BadRequestException(
          `Nhóm ${g.code} có điểm GVHD là ${gvhdScore} (< 6.0), không đủ điều kiện ra hội đồng bảo vệ (yêu cầu điểm GVHD >= 6.0).`,
        );
      }

      // Ràng buộc phân luồng: Nhóm thuộc diện Poster không được gán Hội đồng bảo vệ trực tiếp
      const formatInfo = await this.getGroupDefenseFormat(g.id, dto.semesterId || g.semesterId);
      if (formatInfo.defenseFormat === 'POSTER' && (committeeId || (!dto.defenseFormat && !committee && g.defenses.some((d: any) => d.committeeId)))) {
        throw new BadRequestException(
          `Nhóm ${g.code} ("${g.topic?.title || g.name}") thuộc diện Báo cáo Poster (80% còn lại với điểm phản biện: ${formatInfo.reviewerScore ?? 'N/A'}), không được xếp Hội đồng bảo vệ trực tiếp. Vui lòng xếp phòng/sảnh poster không chọn Hội đồng.`,
        );
      }
    }

    const isPosterMode = dto.defenseFormat === 'POSTER';
    if (isPosterMode) {
      committeeId = null as any;
      committee = null;
    } else if (!committee) {
      for (const g of groups) {
        const existingCommitteeId = g.defenses.find((s: any) => s.committeeId)?.committeeId;
        if (existingCommitteeId) {
          committeeId = existingCommitteeId;
          committee = await this.prisma.defenseCommittee.findUnique({
            where: { id: committeeId },
            include: {
              members: {
                include: {
                  user: { select: { id: true, fullName: true, email: true } },
                },
              },
            },
          });
          break;
        }
      }
    }

    // Identify target schedule IDs to exclude from conflict checking (so rescheduling won't conflict with itself)
    const targetScheduleIds = groups.flatMap((g) => g.defenses.map((s) => s.id));

    // 1. Check Room Clash (Trùng phòng)
    const conflictingRoomSchedules = await this.prisma.defenseSchedule.findMany({
      where: {
        room: { equals: room, mode: 'insensitive' },
        status: { not: 'CANCELLED' },
        id: { notIn: targetScheduleIds },
        startsAt: { lt: endDateTime },
        endsAt: { gt: startDateTime },
      },
      include: {
        group: { select: { id: true, code: true, name: true } },
        committee: { select: { id: true, name: true } },
      },
    });

    if (conflictingRoomSchedules.length > 0) {
      const clash = conflictingRoomSchedules[0];
      const startStr = clash.startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + clash.startsAt.toLocaleDateString('vi-VN');
      const endStr = clash.endsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + clash.endsAt.toLocaleDateString('vi-VN');
      const comStr = clash.committee?.name ? ` (${clash.committee.name})` : '';
      throw new BadRequestException(
        `Xung đột phòng: Phòng "${room}" đã có lịch bảo vệ của nhóm ${clash.group?.code || clash.group?.name}${comStr} từ ${startStr} đến ${endStr}. Vui lòng chọn phòng hoặc khung giờ khác.`,
      );
    }

    // 2. Check Committee Member Clash (Trùng thành viên hội đồng)
    if (committee && committee.members && committee.members.length > 0) {
      const committeeMemberUserIds = committee.members.map((m: any) => m.userId);

      // 2a. Check Anti-Conflict: GVHD không được nằm trong Hội đồng chấm chính nhóm mình hướng dẫn
      for (const group of groups) {
        const advisorUserId = group.topic?.ownerId;
        if (advisorUserId && committeeMemberUserIds.includes(advisorUserId)) {
          const conflictingMember = committee.members.find((m: any) => m.userId === advisorUserId);
          const advisorName = conflictingMember?.user?.fullName || group.topic?.owner?.fullName || 'Giảng viên hướng dẫn';
          throw new BadRequestException(
            `Xung đột vai trò: Giảng viên ${advisorName} là Giảng viên hướng dẫn của nhóm ${group.code} ("${group.topic?.title || group.name}"), không thể xếp nhóm này vào Hội đồng "${committee.name}" có chính GVHD làm thành viên!`,
          );
        }
      }

      const overlappingSchedules = await this.prisma.defenseSchedule.findMany({
        where: {
          committeeId: { not: committee.id },
          status: { not: 'CANCELLED' },
          startsAt: { lt: endDateTime },
          endsAt: { gt: startDateTime },
        },
        include: {
          committee: {
            include: {
              members: {
                where: { userId: { in: committeeMemberUserIds } },
                include: { user: { select: { id: true, fullName: true } } },
              },
            },
          },
          group: { select: { id: true, code: true, name: true } },
        },
      });

      for (const ov of overlappingSchedules) {
        if (ov.committee?.members && ov.committee.members.length > 0) {
          const clashMember = ov.committee.members[0];
          const startStr = ov.startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + ov.startsAt.toLocaleDateString('vi-VN');
          const endStr = ov.endsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + ov.endsAt.toLocaleDateString('vi-VN');
          throw new BadRequestException(
            `Xung đột lịch thành viên hội đồng: Giảng viên ${clashMember.user.fullName} đã có lịch tham gia "${ov.committee.name}" (Nhóm ${ov.group?.code}) tại phòng ${ov.room || 'chưa xếp'} từ ${startStr} đến ${endStr}. Không thể tham gia 2 hội đồng cùng thời điểm!`,
          );
        }
      }
    }

    // 3. Check Group Clash (if group scheduled in another overlapping time)
    for (const g of groups) {
      const otherGroupSchedule = await this.prisma.defenseSchedule.findFirst({
        where: {
          groupId: g.id,
          id: { notIn: targetScheduleIds },
          status: { not: 'CANCELLED' },
          startsAt: { lt: endDateTime },
          endsAt: { gt: startDateTime },
        },
      });
      if (otherGroupSchedule) {
        throw new BadRequestException(
          `Nhóm ${g.code} đã có lịch bảo vệ khác trong khoảng thời gian này`,
        );
      }
    }

    // 4. Update or Create DefenseSchedules in DB
    const totalDurationMs = endDateTime.getTime() - startDateTime.getTime();
    const slotDurationMs = groups.length > 1 ? totalDurationMs / groups.length : totalDurationMs;

    const savedSchedules = await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (let i = 0; i < groups.length; i++) {
        const grp = groups[i];
        const slotStart = groups.length > 1 ? new Date(startDateTime.getTime() + i * slotDurationMs) : startDateTime;
        const slotEnd = groups.length > 1 ? new Date(startDateTime.getTime() + (i + 1) * slotDurationMs) : endDateTime;

        // Check if existing draft schedule for this group exists
        const existingSchedule = grp.defenses.find((s: any) => s.groupId === grp.id);

        let sRecord;
        if (existingSchedule) {
          sRecord = await tx.defenseSchedule.update({
            where: { id: existingSchedule.id },
            data: {
              room,
              startsAt: slotStart,
              endsAt: slotEnd,
              status: 'SCHEDULED',
              committeeId: committeeId || existingSchedule.committeeId,
            },
            include: {
              group: {
                include: {
                  topic: { include: { owner: true } },
                  members: { include: { student: { include: { user: true } } } },
                },
              },
              committee: true,
            },
          });
        } else {
          sRecord = await tx.defenseSchedule.create({
            data: {
              groupId: grp.id,
              semesterId: dto.semesterId || grp.semesterId,
              committeeId: committeeId || undefined,
              room,
              startsAt: slotStart,
              endsAt: slotEnd,
              status: 'SCHEDULED',
            },
            include: {
              group: {
                include: {
                  topic: { include: { owner: true } },
                  members: { include: { student: { include: { user: true } } } },
                },
              },
              committee: true,
            },
          });
        }
        results.push(sRecord);
      }
      return results;
    });

    // 5. Send notifications to all stakeholders
    const shouldNotify = dto.notify !== false;
    if (shouldNotify) {
      for (let i = 0; i < groups.length; i++) {
        const grp = groups[i];
        const saved = savedSchedules[i];
        const topicTitle = grp.topic?.title || grp.name;
        const committeeName = committee?.name || saved.committee?.name;
        const startStr = saved.startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + saved.startsAt.toLocaleDateString('vi-VN');
        const endStr = saved.endsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + saved.endsAt.toLocaleDateString('vi-VN');

        // 5a. Students in group
        for (const m of grp.members) {
          const studentUserId = m.student?.user?.id;
          if (studentUserId) {
            await this.notifications.create({
              userId: studentUserId,
              title: 'Đã có lịch bảo vệ Khóa luận tốt nghiệp chính thức',
              content: `Nhóm "${grp.code}" (Đề tài: ${topicTitle}) đã có lịch bảo vệ chính thức từ ${startStr} đến ${endStr} tại phòng ${room}${committeeName ? ` trước Hội đồng "${committeeName}"` : ''}.`,
              type: 'DEFENSE',
              data: {
                scheduleId: saved.id,
                groupId: grp.id,
                startsAt: saved.startsAt,
                endsAt: saved.endsAt,
                room,
                committeeId: committee?.id,
              },
              sendEmail: true,
            });
          }
        }

        // 5b. Supervisor (GVHD)
        const advisorUserId = grp.topic?.ownerId || grp.topic?.owner?.id;
        if (advisorUserId) {
          await this.notifications.create({
            userId: advisorUserId,
            title: 'Lịch bảo vệ KLTN cho nhóm sinh viên bạn hướng dẫn',
            content: `Nhóm sinh viên bạn hướng dẫn (${grp.code} - ${topicTitle}) đã được xếp lịch bảo vệ từ ${startStr} đến ${endStr} tại phòng ${room}${committeeName ? ` trước Hội đồng "${committeeName}"` : ''}.`,
            type: 'DEFENSE',
            data: {
              scheduleId: saved.id,
              groupId: grp.id,
              startsAt: saved.startsAt,
              endsAt: saved.endsAt,
              room,
            },
            sendEmail: true,
          });
        }

        // 5c. Reviewers (GVPB)
        for (const r of grp.reviewerAssignments || []) {
          const reviewerUserId = r.lecturer?.user?.id;
          if (reviewerUserId) {
            await this.notifications.create({
              userId: reviewerUserId,
              title: 'Lịch bảo vệ KLTN của nhóm bạn phản biện',
              content: `Nhóm sinh viên bạn phản biện (${grp.code} - ${topicTitle}) đã được xếp lịch bảo vệ từ ${startStr} đến ${endStr} tại phòng ${room}.`,
              type: 'DEFENSE',
              data: {
                scheduleId: saved.id,
                groupId: grp.id,
                startsAt: saved.startsAt,
                endsAt: saved.endsAt,
                room,
              },
              sendEmail: true,
            });
          }
        }
      }

      // 5d. Committee members
      if (committee?.members && committee.members.length > 0) {
        const startStr = startDateTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + startDateTime.toLocaleDateString('vi-VN');
        const endStr = endDateTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + endDateTime.toLocaleDateString('vi-VN');
        const groupCodesStr = groups.map((g) => g.code).join(', ');

        for (const m of committee.members) {
          await this.notifications.create({
            userId: m.userId,
            title: 'Lịch chấm Hội đồng bảo vệ Khóa luận tốt nghiệp',
            content: `Bạn có lịch chấm Hội đồng "${committee.name}" (Vai trò: ${m.role}) tại phòng ${room} từ ${startStr} đến ${endStr} cho các nhóm: ${groupCodesStr}.`,
            type: 'DEFENSE',
            data: {
              committeeId: committee.id,
              startsAt: startDateTime,
              endsAt: endDateTime,
              room,
              groupCount: groups.length,
            },
            sendEmail: true,
          });
        }
      }
    }

    return {
      message: 'Xếp lịch và phòng bảo vệ thành công',
      room,
      startsAt: startDateTime,
      endsAt: endDateTime,
      committee: committee
        ? {
            id: committee.id,
            name: committee.name,
            members: committee.members?.map((m: any) => ({
              userId: m.userId,
              fullName: m.user?.fullName,
              role: m.role,
            })),
          }
        : null,
      schedules: savedSchedules.map((s) => ({
        id: s.id,
        groupId: s.groupId,
        groupCode: s.group?.code,
        groupName: s.group?.name,
        topicTitle: s.group?.topic?.title,
        room: s.room,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
      })),
      groupCount: savedSchedules.length,
    };
  }
}
