import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from './audit.service';

@ApiTags('audit') @ApiBearerAuth() @Controller('audit') @UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController { constructor(private readonly service: AuditService) {} @Get() @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON) list(@Query() query: { page?: number; limit?: number; entity?: string; action?: string; userId?: string }) { return this.service.list(query); } }
