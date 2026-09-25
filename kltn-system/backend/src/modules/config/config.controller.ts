import { Body, Controller, Get, Put, Param, Post, Patch, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SystemConfigService } from './config.service';
import { SemesterDto } from './dto/semester.dto';
@ApiTags('config') @ApiBearerAuth() @Controller('config') @UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigController { constructor(private readonly service: SystemConfigService) {} @Get() list() { return this.service.list(); } @Get('semesters') semesters() { return this.service.semesters(); } @Post('semesters') @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON) createSemester(@Body() dto: SemesterDto) { return this.service.createSemester(dto); } @Patch('semesters/:id') @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON) updateSemester(@Param('id') id: string, @Body() dto: Partial<SemesterDto>) { return this.service.updateSemester(id, dto); } @Put(':key') @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON) set(@Param('key') key: string, @Body() body: { value: unknown; description?: string }) { return this.service.set(key, body.value, body.description); } }
