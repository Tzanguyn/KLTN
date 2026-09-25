import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ScoresService } from './scores.service';
import { ApproveScoreUnlockDto } from './dto/approve-score-unlock.dto';
import { RejectScoreUnlockDto } from './dto/reject-score-unlock.dto';

@ApiTags('score-unlock-requests')
@ApiBearerAuth()
@Controller('score-unlock-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoreUnlockRequestsController {
  constructor(private readonly service: ScoresService) {}

  @Get()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu mở khóa sửa điểm (hỗ trợ lọc status=PENDING)' })
  @ApiQuery({ name: 'status', required: false, description: 'Lọc theo trạng thái (PENDING, APPROVED, REJECTED)' })
  findAll(@Query('status') status?: string) {
    return this.service.requests(status);
  }

  @Post(':id/approve')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Phê duyệt yêu cầu mở khóa điểm kèm thời hạn cho phép sửa' })
  approve(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ApproveScoreUnlockDto,
    @Req() req: Request,
  ) {
    return this.service.approveUnlockRequest(user.id, id, dto, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Post(':id/reject')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Từ chối yêu cầu mở khóa sửa điểm kèm lý do' })
  reject(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: RejectScoreUnlockDto,
    @Req() req: Request,
  ) {
    return this.service.rejectUnlockRequest(user.id, id, dto, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
}

