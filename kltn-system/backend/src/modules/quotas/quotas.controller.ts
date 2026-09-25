import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateSemesterQuotasDto } from './dto/update-semester-quotas.dto';
import { QuotasService } from './quotas.service';

@ApiTags('quotas')
@ApiBearerAuth()
@Controller('quotas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotasController {
  constructor(private readonly quotasService: QuotasService) {}

  @ApiOperation({
    summary: 'Lấy danh sách hạn mức hướng dẫn của các giảng viên theo đợt/học kỳ',
    description: 'Hỗ trợ lọc theo semesterId. Nếu không truyền, mặc định lấy học kỳ đang mở hoặc mới nhất.',
  })
  @Get()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  getQuotas(@Query('semesterId') semesterId?: string) {
    return this.quotasService.getQuotas(semesterId);
  }

  @ApiOperation({
    summary: 'Cập nhật hạn mức số nhóm hướng dẫn cho các giảng viên theo đợt/học kỳ (Trưởng bộ môn / Quản lý)',
    description: 'Nhận payload gồm semesterId và danh sách các cặp { lecturerId, maxGroups }.',
  })
  @Put()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  updateQuotas(
    @Body() dto: UpdateSemesterQuotasDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.quotasService.updateQuotas(dto, user.id);
  }
}

