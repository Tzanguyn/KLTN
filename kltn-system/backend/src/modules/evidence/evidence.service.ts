import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EvidenceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { ReviewEvidenceDto } from './dto/review-evidence.dto';
import { ApproveEvidenceDto } from './dto/approve-evidence.dto';
import { RejectEvidenceDto } from './dto/reject-evidence.dto';
import { RequestMoreInfoEvidenceDto } from './dto/request-more-info-evidence.dto';

export interface NckhRule {
  name: string;
  keywords: string[];
  points: number;
}

export interface NckhBonusConfig {
  maxBonusPoints: number;
  defaultPoints: number;
  rules: NckhRule[];
}

export const DEFAULT_NCKH_CONFIG: NckhBonusConfig = {
  maxBonusPoints: 2.0,
  defaultPoints: 1.0,
  rules: [
    {
      name: 'Bài báo khoa học quốc tế (ISI/Scopus/IEEE/ACM/Springer)',
      keywords: ['quoc te', 'ieee', 'scopus', 'isi', 'springer', 'acm', 'international', 'journal'],
      points: 2.0,
    },
    {
      name: 'Giải Nhất sinh viên Nghiên cứu khoa học',
      keywords: ['giai nhat', 'nhất', 'first prize'],
      points: 2.0,
    },
    {
      name: 'Giải Nhì sinh viên Nghiên cứu khoa học',
      keywords: ['giai nhi', 'nhì', 'second prize'],
      points: 1.5,
    },
    {
      name: 'Bài báo hội nghị / tạp chí khoa học chuyên ngành trong nước',
      keywords: ['trong nuoc', 'hoi nghi', 'tap chi', 'quoc gia', 'national'],
      points: 1.0,
    },
    {
      name: 'Giải Ba sinh viên Nghiên cứu khoa học',
      keywords: ['giai ba', 'ba', 'third prize'],
      points: 1.0,
    },
    {
      name: 'Giải Khuyến khích Nghiên cứu khoa học',
      keywords: ['khuyen khich', 'consolation'],
      points: 0.5,
    },
  ],
};

function stripVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Lấy cấu hình quy định cộng điểm NCKH từ SystemConfig hoặc mặc định
   */
  async getNckhBonusConfig(): Promise<NckhBonusConfig> {
    const configRow = await this.prisma.systemConfig.findFirst({
      where: { key: 'NCKH_BONUS_CONFIG' },
    });
    if (configRow?.value && typeof configRow.value === 'object') {
      const val = configRow.value as any;
      return {
        maxBonusPoints: typeof val.maxBonusPoints === 'number' ? val.maxBonusPoints : DEFAULT_NCKH_CONFIG.maxBonusPoints,
        defaultPoints: typeof val.defaultPoints === 'number' ? val.defaultPoints : DEFAULT_NCKH_CONFIG.defaultPoints,
        rules: Array.isArray(val.rules) ? val.rules : DEFAULT_NCKH_CONFIG.rules,
      };
    }
    return DEFAULT_NCKH_CONFIG;
  }

  /**
   * Tính toán điểm thưởng NCKH theo cấu hình quy định của nhà trường
   */
  async calculateBonusPoints(
    evidence: { title: string; description?: string | null },
    studentUserId: string,
    requestedPoints?: number,
  ) {
    const config = await this.getNckhBonusConfig();
    const maxAllowed = config.maxBonusPoints ?? 2.0;

    // Tổng điểm thưởng NCKH sinh viên này đã được duyệt trước đó
    const existingApproved = await this.prisma.evidence.findMany({
      where: { userId: studentUserId, status: EvidenceStatus.APPROVED },
    });
    const currentTotalBonus = existingApproved.reduce(
      (sum, ev) => sum + (ev.points ? Number(ev.points) : 0),
      0,
    );
    const remainingBonusQuota = Math.max(0, Number((maxAllowed - currentTotalBonus).toFixed(2)));

    let points = 0;
    let matchedRule: string | undefined;

    if (requestedPoints !== undefined && requestedPoints !== null && !isNaN(Number(requestedPoints))) {
      points = Math.min(Number(requestedPoints), maxAllowed);
      matchedRule = 'Chỉ định trực tiếp bởi Trưởng bộ môn';
    } else {
      // Tự động phân tích tiêu đề và mô tả minh chứng theo các từ khóa quy định
      const textToAnalyze = stripVietnameseDiacritics(
        `${evidence.title} ${evidence.description || ''}`,
      ).toLowerCase();

      let matched = false;
      for (const rule of config.rules) {
        if (rule.keywords.some((kw) => textToAnalyze.includes(stripVietnameseDiacritics(kw).toLowerCase()))) {
          points = rule.points;
          matchedRule = rule.name;
          matched = true;
          break;
        }
      }

      if (!matched) {
        points = config.defaultPoints ?? 1.0;
        matchedRule = 'Minh chứng NCKH tiêu chuẩn (mặc định)';
      }
    }

    // Đảm bảo không vượt quá trần tối đa còn lại của sinh viên
    const actualPointsAwarded = remainingBonusQuota > 0
      ? Math.min(points, remainingBonusQuota)
      : Math.min(points, maxAllowed);

    return {
      points: Number(actualPointsAwarded.toFixed(2)),
      rawCalculatedPoints: points,
      matchedRule,
      maxAllowed,
      currentTotalBonus,
      remainingBonusQuota,
    };
  }

  /**
   * Danh sách minh chứng NCKH (hỗ trợ lọc status=PENDING, APPROVED, REJECTED, REQUEST_MORE_INFO)
   */
  async list(user: { id: string; roles?: string[] }, status?: string, all = false) {
    const isHead = user.roles?.some((r) => ['TRUONG_BO_MON', 'QUAN_LY_BO_MON'].includes(r)) || all;
    const normalizedStatus = status ? (status.toUpperCase() as EvidenceStatus) : undefined;

    const where: any = {};
    if (!isHead && user.id) {
      where.userId = user.id;
    }
    if (normalizedStatus) {
      where.status = normalizedStatus;
    }

    return this.prisma.evidence.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            studentProfile: { select: { studentCode: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Sinh viên nộp minh chứng NCKH
   */
  async create(userId: string, dto: CreateEvidenceDto, file?: Express.Multer.File) {
    if (!file && !dto.description) {
      throw new BadRequestException('Cần tải tệp hoặc nhập mô tả minh chứng');
    }
    return this.prisma.evidence.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        fileName: file?.originalname,
        fileUrl: file?.path ?? file?.filename,
      },
    });
  }

  /**
   * Phê duyệt minh chứng NCKH và cộng điểm theo quy định cấu hình
   */
  async approve(
    id: string,
    reviewerId: string,
    dto?: ApproveEvidenceDto,
    reqInfo?: { ip?: string; userAgent?: string },
  ) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!evidence) {
      throw new NotFoundException('Không tìm thấy minh chứng NCKH');
    }

    // Tính điểm thưởng theo quy định cấu hình
    const bonusCalc = await this.calculateBonusPoints(evidence, evidence.userId, dto?.points);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.evidence.update({
        where: { id },
        data: {
          status: EvidenceStatus.APPROVED,
          points: bonusCalc.points,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote: dto?.note || bonusCalc.matchedRule || undefined,
        },
      });

      // Ghi Audit Log đầy đủ
      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'APPROVE_EVIDENCE',
          entity: 'Evidence',
          entityId: id,
          metadata: {
            evidenceId: id,
            studentId: evidence.userId,
            studentName: evidence.user?.fullName,
            title: evidence.title,
            points: bonusCalc.points,
            matchedRule: bonusCalc.matchedRule,
            note: dto?.note,
            reviewedAt: new Date().toISOString(),
          },
          ipAddress: reqInfo?.ip,
          userAgent: reqInfo?.userAgent,
        },
      });

      // Gửi thông báo đến sinh viên
      await this.notifications.create({
        userId: evidence.userId,
        title: 'Minh chứng NCKH đã được DUYỆT',
        content: `Trưởng bộ môn đã duyệt minh chứng NCKH "${evidence.title}". Bạn được cộng +${bonusCalc.points} điểm thưởng vào kết quả KLTN.`,
        type: 'SCORE',
        data: {
          evidenceId: id,
          status: 'APPROVED',
          points: bonusCalc.points,
        },
        sendEmail: true,
      });

      return {
        message: `Đã duyệt minh chứng NCKH và cộng ${bonusCalc.points} điểm thưởng thành công.`,
        evidence: updated,
        bonusInfo: bonusCalc,
      };
    });
  }

  /**
   * Từ chối minh chứng NCKH kèm lý do
   */
  async reject(
    id: string,
    reviewerId: string,
    dto: RejectEvidenceDto,
    reqInfo?: { ip?: string; userAgent?: string },
  ) {
    if (!dto?.lyDo?.trim()) {
      throw new BadRequestException('Vui lòng cung cấp lý do từ chối minh chứng.');
    }

    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!evidence) {
      throw new NotFoundException('Không tìm thấy minh chứng NCKH');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.evidence.update({
        where: { id },
        data: {
          status: EvidenceStatus.REJECTED,
          points: null,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote: dto.lyDo.trim(),
        },
      });

      // Ghi Audit Log đầy đủ
      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'REJECT_EVIDENCE',
          entity: 'Evidence',
          entityId: id,
          metadata: {
            evidenceId: id,
            studentId: evidence.userId,
            studentName: evidence.user?.fullName,
            title: evidence.title,
            lyDo: dto.lyDo.trim(),
            rejectedAt: new Date().toISOString(),
          },
          ipAddress: reqInfo?.ip,
          userAgent: reqInfo?.userAgent,
        },
      });

      // Gửi thông báo đến sinh viên
      await this.notifications.create({
        userId: evidence.userId,
        title: 'Minh chứng NCKH bị TỪ CHỐI',
        content: `Minh chứng NCKH "${evidence.title}" đã bị từ chối. Lý do: ${dto.lyDo.trim()}`,
        type: 'SCORE',
        data: {
          evidenceId: id,
          status: 'REJECTED',
          lyDo: dto.lyDo.trim(),
        },
        sendEmail: true,
      });

      return {
        message: 'Đã từ chối minh chứng NCKH.',
        evidence: updated,
      };
    });
  }

  /**
   * Yêu cầu bổ sung thông tin / minh chứng NCKH
   */
  async requestMoreInfo(
    id: string,
    reviewerId: string,
    dto?: RequestMoreInfoEvidenceDto,
    reqInfo?: { ip?: string; userAgent?: string },
  ) {
    const note = dto?.note?.trim() || dto?.lyDo?.trim() || 'Vui lòng bổ sung thêm tài liệu minh chứng cụ thể.';

    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!evidence) {
      throw new NotFoundException('Không tìm thấy minh chứng NCKH');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.evidence.update({
        where: { id },
        data: {
          status: EvidenceStatus.REQUEST_MORE_INFO,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote: note,
        },
      });

      // Ghi Audit Log đầy đủ
      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'REQUEST_MORE_INFO_EVIDENCE',
          entity: 'Evidence',
          entityId: id,
          metadata: {
            evidenceId: id,
            studentId: evidence.userId,
            studentName: evidence.user?.fullName,
            title: evidence.title,
            note,
            requestedAt: new Date().toISOString(),
          },
          ipAddress: reqInfo?.ip,
          userAgent: reqInfo?.userAgent,
        },
      });

      // Gửi thông báo đến sinh viên
      await this.notifications.create({
        userId: evidence.userId,
        title: 'Yêu cầu bổ sung minh chứng NCKH',
        content: `Trưởng bộ môn yêu cầu bổ sung thông tin cho minh chứng NCKH "${evidence.title}". Nội dung: ${note}`,
        type: 'SCORE',
        data: {
          evidenceId: id,
          status: 'REQUEST_MORE_INFO',
          note,
        },
        sendEmail: true,
      });

      return {
        message: 'Đã gửi yêu cầu bổ sung thông tin minh chứng tới sinh viên.',
        evidence: updated,
      };
    });
  }

  /**
   * Phương thức cũ tương thích ngược
   */
  async review(id: string, reviewerId: string, dto: ReviewEvidenceDto) {
    if (dto.approved) {
      return this.approve(id, reviewerId, { points: dto.points, note: dto.note });
    } else {
      return this.reject(id, reviewerId, { lyDo: dto.note || 'Minh chứng NCKH chưa đạt yêu cầu' });
    }
  }
}
