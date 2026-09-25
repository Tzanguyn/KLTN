import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @ApiOperation({
    summary: 'Lấy dữ liệu Dashboard tổng quan theo vai trò (tự động detect vai trò từ JWT)',
    description:
      'Tự động phân biệt vai trò: SINH_VIEN, GIANG_VIEN, TRUONG_BO_MON, QUAN_LY_BO_MON để trả về các thông số KPIs, tiến độ, lịch bảo vệ và các việc cần làm (action items) đặc thù.',
  })
  @ApiResponse({ status: 200, description: 'Lấy dữ liệu dashboard thành công' })
  @Get()
  @Roles(RoleCode.SINH_VIEN, RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  getDashboard(
    @CurrentUser() user: { id: string; email: string; roles: string[] },
    @Query() query: QueryDashboardDto,
  ) {
    return this.service.getDashboard(user, query.semesterId, query.role);
  }
}

