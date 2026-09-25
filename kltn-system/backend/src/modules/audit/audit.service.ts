import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async list(query: { page?: number; limit?: number; entity?: string; action?: string; userId?: string }) {
    const page = Math.max(1, Number(query.page ?? 1)); const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const where = { entity: query.entity || undefined, action: query.action || undefined, userId: query.userId || undefined };
    const [items, total] = await this.prisma.$transaction([this.prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, include: { user: { select: { fullName: true, email: true } } }, orderBy: { createdAt: 'desc' } }), this.prisma.auditLog.count({ where })]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
