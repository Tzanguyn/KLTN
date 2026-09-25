import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SemesterDto } from './dto/semester.dto';
import { SemestersService } from '../semesters/semesters.service';

@Injectable()
export class SystemConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semestersService: SemestersService,
  ) {}

  async list() {
    return this.prisma.systemConfig.findMany({
      include: { semester: true, department: true },
      orderBy: { key: 'asc' },
    });
  }

  async set(key: string, value: unknown, description?: string) {
    const existing = await this.prisma.systemConfig.findFirst({
      where: { key, semesterId: null, departmentId: null },
    });
    if (existing) {
      return this.prisma.systemConfig.update({
        where: { id: existing.id },
        data: { value: value as any, description },
      });
    }
    return this.prisma.systemConfig.create({
      data: { key, value: value as any, description },
    });
  }

  semesters() {
    return this.semestersService.findMany({});
  }

  createSemester(dto: SemesterDto) {
    return this.semestersService.create(dto);
  }

  updateSemester(id: string, dto: Partial<SemesterDto>) {
    return this.semestersService.update(id, dto);
  }
}

