import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssignReviewersDto } from './dto/assign-reviewers.dto';
import { DefenseService } from './defense.service';

@ApiTags('review-assignments')
@ApiBearerAuth()
@Controller('review-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewAssignmentsController {
  constructor(private readonly service: DefenseService) {}

  @ApiOperation({
    summary: 'Phân công 2 Giảng viên phản biện (GVPB) cho nhóm KLTN đủ điều kiện',
    description: 'Chỉ nhóm đã CHO_LAM_TIEP ở giữa kỳ mới được phân công. Tự động loại trừ GVHD và kiểm tra hạn mức tải.',
  })
  @ApiResponse({ status: 200, description: 'Phân công 2 GVPB thành công' })
  @ApiResponse({ status: 400, description: 'Trùng GVHD, chưa CHO_LAM_TIEP hoặc vượt hạn mức' })
  @Post()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  assignTwoReviewers(
    @CurrentUser() user: { id: string },
    @Body() dto: AssignReviewersDto,
  ) {
    return this.service.assignTwoReviewers(user.id, dto);
  }

  @ApiOperation({
    summary: 'Lấy danh sách tất cả phân công phản biện',
  })
  @Get()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  list() {
    return this.service.assignments();
  }
}

