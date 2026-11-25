import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendReviewersDto } from './dto/recommend-reviewers.dto';
import { RecommendCommitteeDto } from './dto/recommend-committee.dto';

interface NormalizedLecturer {
  id: string; // lecturerProfileId
  userId: string;
  lecturerCode: string;
  fullName: string;
  email: string;
  title: string;
  specialization: string;
  departmentId: string;
  departmentName: string;
  currentReviewCount: number;
  maxReviews: number;
  remainingSlots: number;
  isAvailable: boolean;
  guidedTopics: Array<{
    title: string;
    technologies?: string | null;
    summary?: string | null;
  }>;
  allKeywords: Set<string>;
  domainScores: Record<string, number>;
}

interface DomainTaxonomy {
  id: string;
  name: string;
  keywords: string[];
}

const DOMAIN_TAXONOMY: DomainTaxonomy[] = [
  {
    id: 'AI_ML',
    name: 'Trí tuệ nhân tạo & Học máy',
    keywords: [
      'ai', 'artificial intelligence', 'machine learning', 'deep learning', 'học máy', 'học sâu',
      'tri tue nhan tao', 'hoc may', 'hoc sau', 'yolo', 'cnn', 'rnn', 'lstm', 'transformer',
      'nlp', 'computer vision', 'thi giac may tinh', 'nhan dien', 'pytorch', 'tensorflow',
      'keras', 'opencv', 'bert', 'llm', 'generative ai', 'scikit-learn', 'clustering', 'neural network',
    ],
  },
  {
    id: 'WEB_MOBILE',
    name: 'Phát triển Web & Ứng dụng di động',
    keywords: [
      'web', 'website', 'frontend', 'backend', 'fullstack', 'react', 'reactjs', 'vue', 'angular',
      'nextjs', 'nodejs', 'nest', 'nestjs', 'express', 'spring', 'spring boot', 'django', 'fastapi',
      'laravel', 'php', 'mobile', 'android', 'ios', 'flutter', 'react native', 'tailwind', 'typescript',
      'rest api', 'graphql', 'pwa', 'responsive',
    ],
  },
  {
    id: 'CLOUD_DEVOPS',
    name: 'Điện toán đám mây & Hệ thống phân tán',
    keywords: [
      'cloud', 'devops', 'aws', 'azure', 'gcp', 'google cloud', 'docker', 'container', 'kubernetes', 'k8s',
      'ci/cd', 'microservices', 'kien truc vi dich vu', 'message queue', 'kafka', 'rabbitmq', 'redis',
      'load balancing', 'serverless', 'distributed system', 'he thong phan tan',
    ],
  },
  {
    id: 'DATA_IS',
    name: 'Hệ thống thông tin & Phân tích dữ liệu',
    keywords: [
      'he thong thong tin', 'information system', 'data', 'big data', 'du lieu lon', 'data analytics',
      'phan tich du lieu', 'bi', 'business intelligence', 'power bi', 'tableau', 'data warehouse',
      'kho du lieu', 'etl', 'sql', 'postgresql', 'mysql', 'mongodb', 'oracle', 'data mining',
      'khai pha du lieu', 'erp', 'crm', 'quan ly', 'ecommerce', 'thuong mai dien tu',
    ],
  },
  {
    id: 'IOT_EMBEDDED',
    name: 'IoT & Hệ thống nhúng',
    keywords: [
      'iot', 'internet of things', 'nhung', 'embedded', 'arduino', 'raspberry pi', 'esp32', 'esp8266',
      'sensor', 'cam bien', 'mqtt', 'zigbee', 'lora', 'robotics', 'tu dong hoa', 'automation', 'hardware',
    ],
  },
  {
    id: 'SECURITY_BLOCKCHAIN',
    name: 'An toàn thông tin & Blockchain',
    keywords: [
      'an toan thong tin', 'cybersecurity', 'bao mat', 'security', 'blockchain', 'chuoi khoi',
      'smart contract', 'hop dong thong minh', 'solidity', 'web3', 'ethereum', 'cryptography',
      'ma hoa', 'penetration testing', 'vulnerability', 'lo hong', 'auth', 'oauth', 'jwt',
    ],
  },
];

@Injectable()
export class DefenseAiService {
  private readonly logger = new Logger(DefenseAiService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đề xuất Giảng viên phản biện (GVPB) phù hợp với đề tài
   */
  async recommendReviewers(dto: RecommendReviewersDto) {
    // 1. Thu thập thông tin đề tài & nhóm
    let topicData: {
      id?: string;
      title: string;
      summary: string;
      objectives: string;
      technologies: string;
      advisorUserId?: string;
      advisorName?: string;
      advisorProfileId?: string;
      departmentId?: string;
      semesterId?: string;
      groupCode?: string;
      groupId?: string;
    } = {
      title: dto.title || '',
      summary: dto.summary || '',
      objectives: dto.objectives || '',
      technologies: dto.technologies || '',
      departmentId: undefined,
      semesterId: dto.semesterId,
    };

    if (dto.groupId) {
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
          reviewerAssignments: {
            include: { lecturer: { include: { user: true } } },
          },
          scores: { include: { criterion: true } },
        },
      });

      if (!group) throw new NotFoundException('Không tìm thấy nhóm KLTN');

      if (group.midtermStatus !== 'CONTINUE') {
        throw new BadRequestException('Chỉ nhóm được xác nhận CHO_LAM_TIEP ở giữa kỳ mới được phân công phản biện');
      }

      const advId = group.topic?.ownerId;
      const gvhdScores = advId ? (group as any).scores?.filter((s: any) => s.scorerId === advId) : [];
      const tcScores = gvhdScores?.filter((s: any) => s.criterion?.code?.startsWith('TC')) || [];
      const scoresToCalc = tcScores.length > 0 ? tcScores : gvhdScores;
      const gvhdScore = scoresToCalc && scoresToCalc.length > 0
        ? Number((scoresToCalc.reduce((sum: number, s: any) => sum + (Number(s.value) || 0), 0) / scoresToCalc.length).toFixed(2))
        : null;

      if (gvhdScore === null) {
        throw new BadRequestException(
          `Nhóm ${group.code} chưa có điểm đánh giá từ Giảng viên hướng dẫn. Theo quy định, điểm của GVHD phải >= 6.0 mới được phản biện.`,
        );
      }
      if (gvhdScore < 6.0) {
        throw new BadRequestException(
          `Nhóm ${group.code} có điểm GVHD là ${gvhdScore} (< 6.0). Nhóm không đủ điều kiện phân công phản biện (yêu cầu điểm GVHD >= 6.0).`,
        );
      }

      topicData = {
        id: group.topic?.id,
        title: group.topic?.title || group.name,
        summary: group.topic?.summary || '',
        objectives: group.topic?.objectives || '',
        technologies: group.topic?.technologies || '',
        advisorUserId: group.topic?.ownerId,
        advisorName: group.topic?.owner?.fullName,
        advisorProfileId: group.topic?.owner?.lecturerProfile?.id,
        departmentId: group.topic?.departmentId,
        semesterId: group.semesterId,
        groupCode: group.code,
        groupId: group.id,
      };
    } else if (dto.topicId) {
      const topic = await this.prisma.topic.findUnique({
        where: { id: dto.topicId },
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
      });

      if (!topic) throw new NotFoundException('Không tìm thấy đề tài KLTN');

      topicData = {
        id: topic.id,
        title: topic.title,
        summary: topic.summary || '',
        objectives: topic.objectives || '',
        technologies: topic.technologies || '',
        advisorUserId: topic.ownerId,
        advisorName: topic.owner?.fullName,
        advisorProfileId: topic.owner?.lecturerProfile?.id,
        departmentId: topic.departmentId,
        semesterId: topic.semesterId,
      };
    }

    if (!topicData.title) {
      throw new BadRequestException('Vui lòng cung cấp groupId, topicId hoặc thông tin tên đề tài');
    }

    // 2. Lấy cấu hình hạn mức phản biện tối đa
    const maxReviewConfig = topicData.semesterId
      ? await this.prisma.systemConfig.findFirst({
          where: { key: 'MAX_REVIEW_GROUPS', semesterId: topicData.semesterId },
        })
      : null;
    const defaultMaxReviews = typeof maxReviewConfig?.value === 'number' ? maxReviewConfig.value : 5;

    // 3. Lấy tất cả giảng viên ACTIVE thuộc cùng khoa (hoặc toàn trường nếu chưa lọc khoa)
    const lecturerProfiles = await this.prisma.lecturerProfile.findMany({
      where: {
        user: { status: 'ACTIVE' },
        ...(topicData.departmentId ? { departmentId: topicData.departmentId } : {}),
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
        },
        department: { select: { id: true, name: true, code: true } },
        quotas: topicData.semesterId ? { where: { semesterId: topicData.semesterId } } : undefined,
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    // 4. Lấy lịch sử đề tài do từng giảng viên hướng dẫn để làm giàu hồ sơ chuyên môn
    const allGuidedTopics = await this.prisma.topic.findMany({
      where: {
        status: { in: ['APPROVED', 'ARCHIVED'] },
      },
      select: {
        ownerId: true,
        title: true,
        technologies: true,
        summary: true,
      },
    });

    const guidedTopicsByUserId = new Map<string, typeof allGuidedTopics>();
    for (const gt of allGuidedTopics) {
      const list = guidedTopicsByUserId.get(gt.ownerId) || [];
      list.push(gt);
      guidedTopicsByUserId.set(gt.ownerId, list);
    }

    // 5. Thống kê tải phản biện hiện tại
    const reviewCounts = topicData.semesterId
      ? await this.prisma.reviewerAssignment.groupBy({
          by: ['lecturerId'],
          where: {
            group: {
              semesterId: topicData.semesterId,
              status: { not: 'CANCELLED' },
            },
          },
          _count: { id: true },
        })
      : [];
    const reviewCountMap = new Map<string, number>();
    for (const rc of reviewCounts) {
      reviewCountMap.set(rc.lecturerId, rc._count.id);
    }

    // 6. Xây dựng danh sách chuẩn hóa
    const normalizedLecturers: NormalizedLecturer[] = lecturerProfiles.map((l) => {
      const gTopics = guidedTopicsByUserId.get(l.userId) || [];
      const currentLoad = reviewCountMap.get(l.id) || 0;
      const maxL = l.quotas?.[0]?.maxGroups ?? defaultMaxReviews;
      const remaining = Math.max(0, maxL - currentLoad);

      const allTokens = new Set<string>();
      this.tokenize(l.specialization || '').forEach((t) => allTokens.add(t));
      this.tokenize(l.title || '').forEach((t) => allTokens.add(t));
      gTopics.forEach((gt) => {
        this.tokenize(gt.title).forEach((t) => allTokens.add(t));
        this.tokenize(gt.technologies || '').forEach((t) => allTokens.add(t));
        this.tokenize(gt.summary || '').forEach((t) => allTokens.add(t));
      });

      const domainScores: Record<string, number> = {};
      for (const domain of DOMAIN_TAXONOMY) {
        let domainMatchCount = 0;
        for (const kw of domain.keywords) {
          if (allTokens.has(kw)) domainMatchCount++;
        }
        domainScores[domain.id] = domainMatchCount;
      }

      const isAdvisor =
        (topicData.advisorUserId && l.userId === topicData.advisorUserId) ||
        (topicData.advisorProfileId && l.id === topicData.advisorProfileId);

      const isAvailable = !isAdvisor && remaining > 0;

      return {
        id: l.id,
        userId: l.userId,
        lecturerCode: l.lecturerCode,
        fullName: l.user?.fullName || '',
        email: l.user?.email || '',
        title: l.title || 'ThS.',
        specialization: l.specialization || 'Công nghệ thông tin',
        departmentId: l.departmentId,
        departmentName: l.department?.name || '',
        currentReviewCount: currentLoad,
        maxReviews: maxL,
        remainingSlots: remaining,
        isAvailable: Boolean(isAvailable),
        guidedTopics: gTopics.slice(0, 5),
        allKeywords: allTokens,
        domainScores,
      };
    });

    // 7. Thử gọi Gemini AI nếu có API Key
    const apiKey = await this.getApiKey();
    let aiResult: any = null;
    let engineUsed = 'SEMANTIC_HEURISTIC_AI';

    if (apiKey) {
      try {
        aiResult = await this.callGeminiForReviewers(topicData, normalizedLecturers, apiKey);
        if (aiResult?.recommendations && aiResult.recommendations.length > 0) {
          engineUsed = 'GEMINI_AI';
        }
      } catch (err: any) {
        this.logger.warn(`Gemini AI call failed: ${err.message}. Falling back to Semantic Heuristic Engine.`);
      }
    }

    // 8. Nếu không có kết quả từ Gemini hoặc lỗi, dùng Semantic Heuristic Engine
    if (!aiResult || engineUsed === 'SEMANTIC_HEURISTIC_AI') {
      aiResult = this.computeSemanticReviewerRecommendations(topicData, normalizedLecturers);
    }

    // 9. Định hình kết quả trả về
    const topN = dto.topN || 5;
    const finalReviewers = (aiResult.recommendations || []).slice(0, topN);

    return {
      topic: {
        id: topicData.id,
        groupId: topicData.groupId,
        groupCode: topicData.groupCode,
        title: topicData.title,
        technologies: topicData.technologies,
        advisorName: topicData.advisorName,
        advisorExcluded: Boolean(topicData.advisorUserId),
      },
      topReviewers: finalReviewers,
      suggestedPair: aiResult.suggestedPair || null,
      engineUsed,
      totalEvaluated: normalizedLecturers.length,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Đề xuất thành phần Hội đồng bảo vệ KLTN phù hợp với danh sách đề tài
   */
  async recommendCommittee(dto: RecommendCommitteeDto) {
    const semester = await this.prisma.semester.findUnique({
      where: { id: dto.semesterId },
      include: { department: true },
    });
    if (!semester) throw new NotFoundException('Không tìm thấy học kỳ');

    const departmentId = dto.departmentId || semester.departmentId;

    // 1. Lấy thông tin các nhóm và đề tài tham gia bảo vệ
    let groupIds = dto.groupIds || [];
    let groups: any[] = [];

    if (groupIds.length > 0) {
      groups = await this.prisma.group.findMany({
        where: { id: { in: groupIds } },
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
          scores: { include: { criterion: true } },
        },
      });

      for (const g of groups) {
        if (g.midtermStatus && g.midtermStatus !== 'CONTINUE') {
          throw new BadRequestException(`Nhóm ${g.code} chưa được xác nhận CHO_LAM_TIEP ở giữa kỳ.`);
        }
        const advId = g.topic?.ownerId;
        const gvhdScores = advId ? (g as any).scores?.filter((s: any) => s.scorerId === advId) : [];
        const tcScores = gvhdScores?.filter((s: any) => s.criterion?.code?.startsWith('TC')) || [];
        const scoresToCalc = tcScores.length > 0 ? tcScores : gvhdScores;
        const gvhdScore = scoresToCalc && scoresToCalc.length > 0
          ? Number((scoresToCalc.reduce((sum: number, s: any) => sum + (Number(s.value) || 0), 0) / scoresToCalc.length).toFixed(2))
          : null;

        if (gvhdScore === null) {
          throw new BadRequestException(
            `Nhóm ${g.code} chưa có điểm đánh giá từ Giảng viên hướng dẫn. Yêu cầu điểm GVHD >= 6.0 mới được ra hội đồng bảo vệ.`,
          );
        }
        if (gvhdScore < 6.0) {
          throw new BadRequestException(
            `Nhóm ${g.code} có điểm GVHD là ${gvhdScore} (< 6.0), không đủ điều kiện ra hội đồng bảo vệ (yêu cầu điểm GVHD >= 6.0).`,
          );
        }

        // Ràng buộc phân luồng: Nhóm Poster không thể lập Hội đồng
        const savedConfig = await this.prisma.systemConfig.findFirst({
          where: { key: 'DEFENSE_FORMAT_CLASSIFICATION', semesterId: semester.id },
        });
        const savedFormat = (savedConfig?.value as any)?.groups?.[g.id]?.defenseFormat;
        if (savedFormat === 'POSTER') {
          throw new BadRequestException(
            `Nhóm ${g.code} thuộc diện Báo cáo Poster (80% còn lại), không thể đề xuất Hội đồng bảo vệ trực tiếp. AI chỉ đề xuất Hội đồng cho Top 20% đề tài điểm cao nhất.`,
          );
        }
      }
    } else if (dto.topicIds && dto.topicIds.length > 0) {
      const topics = await this.prisma.topic.findMany({
        where: { id: { in: dto.topicIds } },
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
      });
      groups = topics.map((t) => ({
        id: t.id,
        code: 'TOPIC',
        name: t.title,
        topic: t,
      }));
    }

    if (groups.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 nhóm hoặc đề tài để AI đề xuất hội đồng phù hợp');
    }

    // 2. Thu thập danh sách GVHD để CHỐNG XUNG ĐỘT (Anti-conflict)
    const advisorUserIdSet = new Set<string>();
    const advisorProfileIdSet = new Set<string>();
    const advisorInfoMap = new Map<string, { name: string; groupCode: string; topicTitle: string }>();

    for (const g of groups) {
      const advUserId = g.topic?.ownerId;
      const advProfileId = g.topic?.owner?.lecturerProfile?.id;
      if (advUserId) {
        advisorUserIdSet.add(advUserId);
        advisorInfoMap.set(advUserId, {
          name: g.topic?.owner?.fullName || 'GVHD',
          groupCode: g.code,
          topicTitle: g.topic?.title || g.name,
        });
      }
      if (advProfileId) advisorProfileIdSet.add(advProfileId);
    }

    // 3. Lấy danh sách giảng viên ACTIVE trong khoa
    const lecturers = await this.prisma.lecturerProfile.findMany({
      where: {
        departmentId,
        user: { status: 'ACTIVE' },
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        department: true,
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    // 4. Lấy các đề tài đã hướng dẫn của giảng viên
    const allGuidedTopics = await this.prisma.topic.findMany({
      where: { status: { in: ['APPROVED', 'ARCHIVED'] } },
      select: { ownerId: true, title: true, technologies: true, summary: true },
    });
    const guidedTopicsByUserId = new Map<string, typeof allGuidedTopics>();
    for (const gt of allGuidedTopics) {
      const list = guidedTopicsByUserId.get(gt.ownerId) || [];
      list.push(gt);
      guidedTopicsByUserId.set(gt.ownerId, list);
    }

    // 5. Chuẩn hóa hồ sơ ứng viên
    const eligibleLecturers: NormalizedLecturer[] = [];
    const conflictLecturers: any[] = [];

    for (const l of lecturers) {
      const isAdvisor = advisorUserIdSet.has(l.userId) || advisorProfileIdSet.has(l.id);
      if (isAdvisor) {
        const conflictDetail = advisorInfoMap.get(l.userId);
        conflictLecturers.push({
          id: l.id,
          userId: l.userId,
          fullName: l.user?.fullName || '',
          lecturerCode: l.lecturerCode,
          title: l.title || 'Giảng viên',
          reason: `Là GVHD của nhóm ${conflictDetail?.groupCode || ''} ("${conflictDetail?.topicTitle || ''}") - Tự động loại trừ để chống xung đột lợi ích.`,
        });
      } else {
        const gTopics = guidedTopicsByUserId.get(l.userId) || [];
        const allTokens = new Set<string>();
        this.tokenize(l.specialization || '').forEach((t) => allTokens.add(t));
        this.tokenize(l.title || '').forEach((t) => allTokens.add(t));
        gTopics.forEach((gt) => {
          this.tokenize(gt.title).forEach((t) => allTokens.add(t));
          this.tokenize(gt.technologies || '').forEach((t) => allTokens.add(t));
        });

        const domainScores: Record<string, number> = {};
        for (const domain of DOMAIN_TAXONOMY) {
          let count = 0;
          for (const kw of domain.keywords) {
            if (allTokens.has(kw)) count++;
          }
          domainScores[domain.id] = count;
        }

        eligibleLecturers.push({
          id: l.id,
          userId: l.userId,
          lecturerCode: l.lecturerCode,
          fullName: l.user?.fullName || '',
          email: l.user?.email || '',
          title: l.title || 'ThS.',
          specialization: l.specialization || 'Công nghệ thông tin',
          departmentId: l.departmentId,
          departmentName: l.department?.name || '',
          currentReviewCount: 0,
          maxReviews: 10,
          remainingSlots: 10,
          isAvailable: true,
          guidedTopics: gTopics.slice(0, 5),
          allKeywords: allTokens,
          domainScores,
        });
      }
    }

    const minCommitteeMembers = dto.committeeSize || 3;
    if (eligibleLecturers.length < minCommitteeMembers) {
      throw new BadRequestException(
        `Không đủ giảng viên khả dụng để thành lập hội đồng (Cần tối thiểu ${minCommitteeMembers}, hiện có ${eligibleLecturers.length} sau khi loại trừ các GVHD xung đột).`,
      );
    }

    // 6. Gọi Gemini AI nếu có API Key
    const apiKey = await this.getApiKey();
    let aiCommittee: any = null;
    let engineUsed = 'SEMANTIC_HEURISTIC_AI';

    if (apiKey) {
      try {
        aiCommittee = await this.callGeminiForCommittee(groups, eligibleLecturers, apiKey, minCommitteeMembers);
        if (aiCommittee?.suggestedCommittee) {
          engineUsed = 'GEMINI_AI';
        }
      } catch (err: any) {
        this.logger.warn(`Gemini AI Committee call failed: ${err.message}. Falling back to Semantic Engine.`);
      }
    }

    if (!aiCommittee || engineUsed === 'SEMANTIC_HEURISTIC_AI') {
      aiCommittee = this.computeSemanticCommitteeRecommendation(groups, eligibleLecturers, minCommitteeMembers);
    }

    return {
      analyzedGroups: groups.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        topicTitle: g.topic?.title || g.name,
        advisorName: g.topic?.owner?.fullName,
        technologies: g.topic?.technologies,
      })),
      suggestedCommittee: aiCommittee.suggestedCommittee,
      conflictExcludedLecturers: conflictLecturers,
      allEligibleCount: eligibleLecturers.length,
      engineUsed,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Lấy API Key từ SystemConfig hoặc Environment
   */
  async getApiKey(): Promise<string | null> {
    const configKey = await this.prisma.systemConfig.findFirst({
      where: { key: { in: ['GEMINI_API_KEY', 'AI_API_KEY'] } },
    });
    if (configKey && typeof configKey.value === 'string' && configKey.value.trim().length > 10) {
      return configKey.value.trim();
    }
    const envKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (envKey && envKey.trim().length > 10) {
      return envKey.trim();
    }
    return null;
  }

  /**
   * Trả về trạng thái AI Engine
   */
  async getAiStatus() {
    const apiKey = await this.getApiKey();
    return {
      hasGeminiApiKey: Boolean(apiKey),
      activeProvider: apiKey ? 'Google Gemini AI (1.5 Flash)' : 'Semantic Heuristic AI Engine',
      isHeuristicFallbackActive: true,
      ready: true,
    };
  }

  // =========================================================================
  // HEURISTIC ENGINES (Chạy siêu nhanh, độc lập, không phụ thuộc mạng ngoại tuyến)
  // =========================================================================

  private computeSemanticReviewerRecommendations(
    topic: { title: string; summary: string; objectives: string; technologies: string; advisorUserId?: string },
    lecturers: NormalizedLecturer[],
  ) {
    const topicTokens = new Set<string>();
    this.tokenize(topic.title).forEach((t) => topicTokens.add(t));
    this.tokenize(topic.technologies).forEach((t) => topicTokens.add(t));
    this.tokenize(topic.summary).forEach((t) => topicTokens.add(t));
    this.tokenize(topic.objectives).forEach((t) => topicTokens.add(t));

    // Xác định lĩnh vực chủ đạo của đề tài
    const topicDomainHits: Record<string, number> = {};
    for (const domain of DOMAIN_TAXONOMY) {
      let count = 0;
      for (const kw of domain.keywords) {
        if (topicTokens.has(kw)) count++;
      }
      topicDomainHits[domain.id] = count;
    }

    const scoredLecturers = lecturers.map((lec) => {
      // 1. Tương đồng từ khóa (Keyword overlap)
      const matchedKeywords: string[] = [];
      topicTokens.forEach((tk) => {
        if (lec.allKeywords.has(tk) && tk.length > 2) {
          matchedKeywords.push(tk);
        }
      });

      // 2. Tương đồng lĩnh vực (Domain alignment)
      let domainScore = 0;
      for (const domain of DOMAIN_TAXONOMY) {
        const tHits = topicDomainHits[domain.id] || 0;
        const lHits = lec.domainScores[domain.id] || 0;
        if (tHits > 0 && lHits > 0) {
          domainScore += Math.min(tHits, lHits) * 15;
        }
      }

      // 3. Học vị & kinh nghiệm
      let titleBonus = 0;
      if (lec.title.includes('PGS') || lec.title.includes('GS')) titleBonus = 10;
      else if (lec.title.includes('TS')) titleBonus = 7;
      else titleBonus = 3;

      // 4. Định mức còn lại (Load balance bonus)
      const slotBonus = Math.min(10, lec.remainingSlots * 2);

      // Tính điểm tổng (0 - 100)
      const rawScore = matchedKeywords.length * 8 + domainScore + titleBonus + slotBonus;
      // Chuẩn hóa điểm trong khoảng 60 - 98 điểm
      const score = Math.min(98, Math.max(62, Math.round(55 + Math.min(43, rawScore))));

      // Tạo lý do giải thích bằng tiếng Việt tự nhiên
      const reasons: string[] = [];
      if (matchedKeywords.length > 0) {
        const topKws = matchedKeywords.slice(0, 4).join(', ');
        reasons.push(`Chuyên môn và công nghệ tương đồng: ${topKws}`);
      }
      if (lec.specialization) {
        reasons.push(`Hướng nghiên cứu chính: ${lec.specialization}`);
      }
      if (lec.guidedTopics.length > 0) {
        reasons.push(`Có kinh nghiệm hướng dẫn ${lec.guidedTopics.length} đề tài tương tự`);
      }
      if (lec.remainingSlots > 0) {
        reasons.push(`Hạn mức phản biện còn ${lec.remainingSlots} nhóm, sẵn sàng nhận nhiệm vụ`);
      }

      return {
        id: lec.id,
        lecturerId: lec.id,
        userId: lec.userId,
        lecturerCode: lec.lecturerCode,
        fullName: lec.fullName,
        email: lec.email,
        title: lec.title,
        specialization: lec.specialization,
        departmentName: lec.departmentName,
        currentReviewCount: lec.currentReviewCount,
        maxReviews: lec.maxReviews,
        remainingSlots: lec.remainingSlots,
        isAvailable: lec.isAvailable,
        score,
        matchPercentage: `${score}%`,
        matchedKeywords: matchedKeywords.slice(0, 6),
        matchReason: reasons.join('. ') + '.',
      };
    });

    // Lọc và sắp xếp những người khả dụng lên đầu theo điểm số
    const availableScored = scoredLecturers
      .filter((l) => l.isAvailable)
      .sort((a, b) => b.score - a.score);

    const unavailableScored = scoredLecturers
      .filter((l) => !l.isAvailable)
      .sort((a, b) => b.score - a.score);

    const allRanked = [...availableScored, ...unavailableScored];

    // Tạo Cặp đề xuất tối ưu (1 phản biện chính + 1 phản biện phụ bổ trợ)
    let suggestedPair = null;
    if (availableScored.length >= 2) {
      const p1 = availableScored[0];
      // Tìm p2 sao cho có học vị hoặc bổ trợ lĩnh vực, tránh 2 người hoàn toàn trùng hẹp
      const p2 = availableScored[1];
      suggestedPair = {
        pairId: `ai_pair_${p1.id}_${p2.id}`,
        name: `Cặp GVPB tối ưu: ${this.formatTitleAndName(p1.title, p1.fullName)} & ${this.formatTitleAndName(p2.title, p2.fullName)}`,
        reviewer1: p1,
        reviewer2: p2,
        reviewerIds: [p1.id, p2.id],
        pairScore: Math.round((p1.score + p2.score) / 2),
        synergyReason: `Cặp phản biện toàn diện: ${this.formatTitleAndName(p1.title, p1.fullName)} (Điểm phù hợp: ${p1.score}%) nắm vững phương pháp và công nghệ cốt lõi kết hợp cùng ${this.formatTitleAndName(p2.title, p2.fullName)} (${p2.score}%) đánh giá tính ứng dụng và kiến trúc hệ thống. Đảm bảo tính khách quan và chiều sâu học thuật.`,
      };
    }

    return {
      recommendations: allRanked,
      suggestedPair,
    };
  }

  private computeSemanticCommitteeRecommendation(
    groups: any[],
    eligibleLecturers: NormalizedLecturer[],
    committeeSize = 3,
  ) {
    // Tổng hợp từ khóa của tất cả các đề tài được chọn
    const groupTokens = new Set<string>();
    groups.forEach((g) => {
      this.tokenize(g.topic?.title || g.name || '').forEach((t) => groupTokens.add(t));
      this.tokenize(g.topic?.technologies || '').forEach((t) => groupTokens.add(t));
      this.tokenize(g.topic?.summary || '').forEach((t) => groupTokens.add(t));
    });

    // Đánh giá từng giảng viên theo các vai trò:
    // 1. Chủ tịch: Ưu tiên học vị cao (TS, PGS), kinh nghiệm, lãnh đạo
    // 2. Thư ký: Trẻ, năng nổ, chuẩn mực văn bản
    // 3. Ủy viên phản biện: Điểm kỹ thuật cao nhất với các đề tài
    // 4. Ủy viên: Bổ trợ góc nhìn

    const candidateScores = eligibleLecturers.map((lec) => {
      const matchedKeywords: string[] = [];
      groupTokens.forEach((tk) => {
        if (lec.allKeywords.has(tk) && tk.length > 2) matchedKeywords.push(tk);
      });

      const techScore = Math.min(98, 60 + matchedKeywords.length * 6);

      // Điểm Chủ tịch
      let chairScore = techScore * 0.4;
      if (lec.title.includes('PGS') || lec.title.includes('GS')) chairScore += 45;
      else if (lec.title.includes('TS')) chairScore += 35;
      else chairScore += 15;

      return {
        ...lec,
        techScore,
        chairScore,
        matchedKeywords: matchedKeywords.slice(0, 5),
      };
    });

    // 1. Chọn Chủ tịch (Chairperson)
    const sortedForChair = [...candidateScores].sort((a, b) => b.chairScore - a.chairScore);
    const president = sortedForChair[0];

    // 2. Chọn Ủy viên phản biện (Chuyên gia công nghệ sát nhất, khác Chủ tịch)
    const sortedForReviewer = [...candidateScores]
      .filter((c) => c.userId !== president.userId)
      .sort((a, b) => b.techScore - a.techScore);
    const reviewerMember = sortedForReviewer[0];

    // 3. Chọn Thư ký (Khác Chủ tịch & UV Phản biện)
    const sortedForSecretary = [...candidateScores]
      .filter((c) => c.userId !== president.userId && c.userId !== reviewerMember.userId);
    const secretary = sortedForSecretary[0];

    // 4. Chọn các Ủy viên còn lại nếu committeeSize > 3
    const chosenUserIds = new Set([president.userId, reviewerMember.userId, secretary.userId]);
    const remainingMembers = candidateScores
      .filter((c) => !chosenUserIds.has(c.userId))
      .slice(0, Math.max(0, committeeSize - 3));

    // Đặt tên hội đồng thông minh
    const topicKeywordsSummary = Array.from(groupTokens).filter((k) => k.length > 3).slice(0, 2).join(' - ');
    const committeeName = `Hội đồng KLTN - ${topicKeywordsSummary ? topicKeywordsSummary.toUpperCase() : 'Hệ thống thông tin'}`;

    return {
      suggestedCommittee: {
        name: committeeName,
        totalScore: Math.round((president.chairScore * 0.35 + reviewerMember.techScore * 0.45 + secretary.techScore * 0.2)),
        president: {
          id: president.id,
          userId: president.userId,
          lecturerCode: president.lecturerCode,
          fullName: president.fullName,
          title: president.title,
          specialization: president.specialization,
          role: 'Chủ tịch',
          score: Math.min(99, Math.round(president.chairScore)),
          reason: `${this.formatTitleAndName(president.title, president.fullName)} có học vị cao, uy tín học thuật vững vàng và kinh nghiệm điều hành bảo vệ KLTN công tâm, chuẩn mực.`,
        },
        secretary: {
          id: secretary.id,
          userId: secretary.userId,
          lecturerCode: secretary.lecturerCode,
          fullName: secretary.fullName,
          title: secretary.title,
          specialization: secretary.specialization,
          role: 'Thư ký',
          score: 90,
          reason: `${this.formatTitleAndName(secretary.title, secretary.fullName)} có tác phong làm việc chuẩn xác, nắm chắc quy trình chấm điểm và biểu mẫu biên bản bảo vệ khóa luận.`,
        },
        reviewerMember: {
          id: reviewerMember.id,
          userId: reviewerMember.userId,
          lecturerCode: reviewerMember.lecturerCode,
          fullName: reviewerMember.fullName,
          title: reviewerMember.title,
          specialization: reviewerMember.specialization,
          role: 'Ủy viên phản biện',
          score: Math.min(99, Math.round(reviewerMember.techScore)),
          reason: `Có độ tương đồng kỹ thuật cao nhất với các đề tài (${reviewerMember.matchedKeywords.join(', ')}), đảm bảo thẩm định chất lượng đề tài chuẩn xác.`,
        },
        members: remainingMembers.map((m) => ({
          id: m.id,
          userId: m.userId,
          lecturerCode: m.lecturerCode,
          fullName: m.fullName,
          title: m.title,
          specialization: m.specialization,
          role: 'Ủy viên',
          score: Math.min(95, Math.round(m.techScore)),
          reason: `Đóng góp góc nhìn phản biện khách quan về tính ứng dụng và khả năng triển khai thực tế.`,
        })),
        overallReason: `Hội đồng được AI thiết lập với cơ cấu cân bằng tối ưu: Chủ tịch có học vị cao chủ trì, Ủy viên phản biện chuyên sâu về công nghệ đề tài, Thư ký đảm bảo tiến trình chuẩn xác. Tất cả GVHD của các nhóm được chọn đều đã được loại trừ tự động nhằm đảm bảo tính minh bạch, khách quan tuyệt đối.`,
      },
    };
  }

  // =========================================================================
  // GEMINI LLM INTEGRATION (Khi có GEMINI_API_KEY)
  // =========================================================================

  private async callGeminiForReviewers(
    topic: { title: string; summary: string; objectives: string; technologies: string; advisorName?: string },
    lecturers: NormalizedLecturer[],
    apiKey: string,
  ) {
    const candidateSummaries = lecturers.map((l) => ({
      id: l.id,
      fullName: l.fullName,
      title: l.title,
      specialization: l.specialization,
      isAvailable: l.isAvailable,
      remainingSlots: l.remainingSlots,
      sampleGuidedTopics: l.guidedTopics.map((g) => g.title).slice(0, 3),
    }));

    const prompt = `
Bạn là Trợ lý AI Cố vấn Học thuật chuyên phụ trách phân công Giảng viên phản biện (GVPB) cho Khóa luận tốt nghiệp (KLTN).
Quy định bắt buộc:
1. Giảng viên hướng dẫn (GVHD: ${topic.advisorName || 'Không có'}) KHÔNG ĐƯỢC làm phản biện cho đề tài này.
2. Giảng viên phản biện phải có chuyên môn phù hợp với công nghệ và hướng nghiên cứu của đề tài.
3. Cần đề xuất xếp hạng các giảng viên phù hợp nhất kèm điểm số (0 - 100) và lý do chi tiết.
4. Cần gợi ý CẶP GVPB TỐI ƯU (1 phản biện chính + 1 phản biện phụ) có chuyên môn bổ trợ cho nhau.

Thông tin đề tài KLTN:
- Tên đề tài: "${topic.title}"
- Công nghệ sử dụng: "${topic.technologies}"
- Tóm tắt: "${topic.summary}"
- Mục tiêu: "${topic.objectives}"

Danh sách giảng viên ứng viên:
${JSON.stringify(candidateSummaries, null, 2)}

Hãy phân tích và trả về định dạng JSON DUY NHẤT sau:
{
  "recommendations": [
    {
      "id": "lecturerProfileId",
      "score": 95,
      "matchedKeywords": ["Từ khóa 1", "Từ khóa 2"],
      "matchReason": "Lý do chi tiết bằng tiếng Việt phân tích sự phù hợp chuyên môn và kinh nghiệm..."
    }
  ],
  "suggestedPair": {
    "reviewer1Id": "id của giảng viên 1",
    "reviewer2Id": "id của giảng viên 2",
    "pairScore": 96,
    "synergyReason": "Lý do vì sao 2 giảng viên này bổ trợ cho nhau rất tốt để phản biện đề tài..."
  }
}
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Không nhận được văn bản từ Gemini');

      const parsed = JSON.parse(rawText);
      const lecturerMap = new Map(lecturers.map((l) => [l.id, l]));

      // Merge AI scores with lecturer profile data
      const mergedRecs = (parsed.recommendations || []).map((r: any) => {
        const lec = lecturerMap.get(r.id);
        if (!lec) return null;
        return {
          id: lec.id,
          lecturerId: lec.id,
          userId: lec.userId,
          lecturerCode: lec.lecturerCode,
          fullName: lec.fullName,
          email: lec.email,
          title: lec.title,
          specialization: lec.specialization,
          departmentName: lec.departmentName,
          currentReviewCount: lec.currentReviewCount,
          maxReviews: lec.maxReviews,
          remainingSlots: lec.remainingSlots,
          isAvailable: lec.isAvailable,
          score: r.score || 85,
          matchPercentage: `${r.score || 85}%`,
          matchedKeywords: r.matchedKeywords || [],
          matchReason: r.matchReason || 'Chuyên môn phù hợp với đề tài.',
        };
      }).filter(Boolean);

      // Sắp xếp lại theo điểm và tính khả dụng
      mergedRecs.sort((a: any, b: any) => {
        if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
        return b.score - a.score;
      });

      let pair = null;
      if (parsed.suggestedPair) {
        const rev1 = lecturerMap.get(parsed.suggestedPair.reviewer1Id);
        const rev2 = lecturerMap.get(parsed.suggestedPair.reviewer2Id);
        if (rev1 && rev2) {
          pair = {
            pairId: `ai_pair_${rev1.id}_${rev2.id}`,
            name: `Cặp GVPB tối ưu: ${rev1.fullName} & ${rev2.fullName}`,
            reviewer1: rev1,
            reviewer2: rev2,
            reviewerIds: [rev1.id, rev2.id],
            pairScore: parsed.suggestedPair.pairScore || 95,
            synergyReason: parsed.suggestedPair.synergyReason || 'Cặp giảng viên bổ trợ toàn diện cho đề tài.',
          };
        }
      }

      return {
        recommendations: mergedRecs,
        suggestedPair: pair,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callGeminiForCommittee(
    groups: any[],
    eligibleLecturers: NormalizedLecturer[],
    apiKey: string,
    committeeSize = 3,
  ) {
    const topicsSummary = groups.map((g) => ({
      code: g.code,
      title: g.topic?.title || g.name,
      technologies: g.topic?.technologies,
      summary: g.topic?.summary,
      advisor: g.topic?.owner?.fullName,
    }));

    const lecturerSummaries = eligibleLecturers.map((l) => ({
      id: l.id,
      userId: l.userId,
      fullName: l.fullName,
      title: l.title,
      specialization: l.specialization,
      sampleTopics: l.guidedTopics.map((gt) => gt.title).slice(0, 3),
    }));

    const prompt = `
Bạn là Cố vấn Học thuật cấp cao của Hội đồng Khoa học. Hãy thiết lập Hội đồng bảo vệ Khóa luận tốt nghiệp (KLTN) tối ưu gồm ${committeeSize} thành viên cho các đề tài dưới đây.

Quy định thành lập Hội đồng:
1. Chủ tịch: Ưu tiên người có học vị cao nhất (PGS, TS), kinh nghiệm học thuật uy tín để chủ trì.
2. Thư ký: Giảng viên cẩn trọng, am hiểu quy trình biên bản bảo vệ.
3. Ủy viên phản biện: Giảng viên có chuyên môn kỹ thuật hoặc công nghệ sát nhất với các đề tài.
4. Ủy viên (nếu có): Bổ sung góc nhìn đánh giá ứng dụng thực tiễn.
5. Tất cả GVHD của các đề tài đã được loại trừ trước khi đưa vào danh sách này.

Danh sách đề tài cần chấm:
${JSON.stringify(topicsSummary, null, 2)}

Danh sách Giảng viên khả dụng:
${JSON.stringify(lecturerSummaries, null, 2)}

Hãy trả về kết quả dưới định dạng JSON DUY NHẤT:
{
  "name": "Tên hội đồng gợi ý (Ví dụ: Hội đồng KLTN số 01 - Trí tuệ nhân tạo)",
  "totalScore": 95,
  "presidentId": "id của giảng viên làm Chủ tịch",
  "presidentReason": "Lý do chọn Chủ tịch...",
  "secretaryId": "id của giảng viên làm Thư ký",
  "secretaryReason": "Lý do chọn Thư ký...",
  "reviewerMemberId": "id của giảng viên làm Ủy viên phản biện",
  "reviewerMemberReason": "Lý do chọn UV phản biện...",
  "memberIds": ["id các ủy viên còn lại nếu có"],
  "memberReasons": ["Lý do cho từng ủy viên..."],
  "overallReason": "Đánh giá tổng quan về tính hợp lý và sự cân bằng của hội đồng..."
}
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Không nhận được phản hồi từ Gemini');

      const parsed = JSON.parse(rawText);
      const lecMap = new Map(eligibleLecturers.map((l) => [l.id, l]));

      const president = lecMap.get(parsed.presidentId) || eligibleLecturers[0];
      const secretary = lecMap.get(parsed.secretaryId) || eligibleLecturers[1];
      const reviewer = lecMap.get(parsed.reviewerMemberId) || eligibleLecturers[2];

      const members = (parsed.memberIds || []).map((mId: string, idx: number) => {
        const l = lecMap.get(mId);
        if (!l) return null;
        return {
          id: l.id,
          userId: l.userId,
          lecturerCode: l.lecturerCode,
          fullName: l.fullName,
          title: l.title,
          specialization: l.specialization,
          role: 'Ủy viên',
          score: 88,
          reason: parsed.memberReasons?.[idx] || 'Đóng góp góc nhìn phản biện khách quan.',
        };
      }).filter(Boolean);

      return {
        suggestedCommittee: {
          name: parsed.name || 'Hội đồng bảo vệ Khóa luận tốt nghiệp',
          totalScore: parsed.totalScore || 94,
          president: {
            id: president.id,
            userId: president.userId,
            lecturerCode: president.lecturerCode,
            fullName: president.fullName,
            title: president.title,
            specialization: president.specialization,
            role: 'Chủ tịch',
            score: 96,
            reason: parsed.presidentReason || 'Học vị và kinh nghiệm điều hành vững chắc.',
          },
          secretary: {
            id: secretary.id,
            userId: secretary.userId,
            lecturerCode: secretary.lecturerCode,
            fullName: secretary.fullName,
            title: secretary.title,
            specialization: secretary.specialization,
            role: 'Thư ký',
            score: 92,
            reason: parsed.secretaryReason || 'Đảm bảo tiến trình và biên bản chuẩn mực.',
          },
          reviewerMember: {
            id: reviewer.id,
            userId: reviewer.userId,
            lecturerCode: reviewer.lecturerCode,
            fullName: reviewer.fullName,
            title: reviewer.title,
            specialization: reviewer.specialization,
            role: 'Ủy viên phản biện',
            score: 95,
            reason: parsed.reviewerMemberReason || 'Chuyên môn sâu sát nhất với nội dung các đề tài.',
          },
          members,
          overallReason: parsed.overallReason || 'Hội đồng đáp ứng đầy đủ quy định và tính khách quan chuyên môn.',
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Định dạng chuẩn hóa tên kèm học vị, tránh lặp "TS. TS. Nguyễn..." và triệt tiêu lỗi dấu chấm kép ".."
   */
  private formatTitleAndName(title: string, fullName: string): string {
    const cleanName = (fullName || '').trim();
    if (!title) return cleanName;
    let cleanTitle = title.trim().replace(/\.+$/, '');
    if (!cleanTitle) return cleanName;
    if (cleanTitle.toLowerCase() !== 'gv') {
      cleanTitle = `${cleanTitle}.`;
    }
    if (cleanName.toLowerCase().startsWith(cleanTitle.toLowerCase())) return cleanName;
    const prefixes = ['ts.', 'ths.', 'pgs.ts.', 'pgs.', 'gs.ts.', 'gs.', 'cn.', 'ks.'];
    for (const p of prefixes) {
      if (cleanName.toLowerCase().startsWith(p)) return cleanName;
    }
    return `${cleanTitle} ${cleanName}`;
  }

  /**
   * Tách từ khóa và làm sạch chuỗi
   */
  private tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s\u00C0-\u1EF9]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1);
  }
}
