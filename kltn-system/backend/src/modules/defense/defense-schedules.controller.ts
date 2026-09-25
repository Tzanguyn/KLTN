import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DefenseService } from './defense.service';
import { ScheduleDefenseDto } from './dto/schedule-defense.dto';

@ApiTags('defense-schedules')
@ApiBearerAuth()
@Controller('defense-schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DefenseSchedulesController {
  constructor(private readonly defenseService: DefenseService) {}

  @ApiOperation({
    summary: 'Lấy danh sách lịch bảo vệ và phòng thi Khóa luận tốt nghiệp',
  })
  @ApiResponse({ status: 200, description: 'Danh sách lịch bảo vệ' })
  @Get()
  async getSchedules(@Query('semesterId') semesterId?: string) {
    return this.defenseService.schedules(semesterId);
  }

  @ApiOperation({
    summary: 'Xếp lịch và phòng bảo vệ Khóa luận tốt nghiệp (có kiểm tra trùng phòng và trùng thành viên hội đồng)',
  })
  @ApiResponse({ status: 201, description: 'Xếp lịch thành công và đã gửi thông báo đến các bên liên quan' })
  @ApiResponse({ status: 400, description: 'Lỗi trùng phòng, trùng thành viên hội đồng hoặc tham số không hợp lệ' })
  @Post()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  async scheduleDefense(
    @CurrentUser() user: { id: string },
    @Body() dto: ScheduleDefenseDto,
  ) {
    return this.defenseService.scheduleDefense(user.id, dto);
  }
}

