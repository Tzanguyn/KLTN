import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssignReviewersDto } from './dto/assign-reviewers.dto';
import { AssignThirdReviewerDto } from './dto/assign-third-reviewer.dto';
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
    summary: 'Phân công Giảng viên phản biện thứ 3 (GVPB 3) khi có chênh lệch điểm',
    description:
      'Trường hợp điểm giữa 2 GVPB chênh nhau >= 4 điểm hoặc điểm của GVPB và GVHD chênh nhau >= 2 điểm, Trưởng bộ môn phân công GVPB thứ 3. Khi đó điểm của GVPB là trung bình của 3 GVPB.',
  })
  @ApiResponse({ status: 200, description: 'Phân công GVPB thứ 3 thành công' })
  @ApiResponse({ status: 400, description: 'Không thỏa điều kiện lệch điểm hoặc trùng giảng viên' })
  @Post('third-reviewer')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  assignThirdReviewer(
    @CurrentUser() user: { id: string },
    @Body() dto: AssignThirdReviewerDto,
  ) {
    return this.service.assignThirdReviewer(user.id, dto);
  }

  @ApiOperation({
    summary: 'Hủy phân công Giảng viên phản biện thứ 3 của nhóm',
  })
  @ApiResponse({ status: 200, description: 'Hủy phân công GVPB thứ 3 thành công' })
  @Delete('third-reviewer/:groupId')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  removeThirdReviewer(
    @CurrentUser() user: { id: string },
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.service.removeThirdReviewer(user.id, groupId);
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

