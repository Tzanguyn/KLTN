import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';

@ApiTags('lecturers')
@ApiBearerAuth()
@Controller('lecturers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LecturersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Dashboard tổng quan Giảng viên hướng dẫn',
    description:
      'Số nhóm đang hướng dẫn, % hoàn thành trung bình, số lần nộp, cảnh báo chậm tiến độ, trạng thái giữa kỳ',
  })
  @ApiResponse({ status: 200, description: 'Lấy thông tin dashboard giảng viên thành công' })
  @Get('me/dashboard')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  getLecturerDashboard(@CurrentUser() user: { id: string }) {
    return this.usersService.getLecturerDashboard(user.id);
  }

  @ApiOperation({
    summary: 'Xem danh sách đề tài được phân công làm Giảng viên phản biện (GVPB)',
    description:
      'Danh sách nhóm đề tài được phân công phản biện, thông tin GVHD, bài nộp báo cáo và trạng thái chấm điểm',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách phân công phản biện thành công' })
  @Get('me/review-assignments')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  getLecturerReviewAssignments(@CurrentUser() user: { id: string }) {
    return this.usersService.getLecturerReviewAssignments(user.id);
  }

  @ApiOperation({
    summary: 'Xem danh sách hội đồng bảo vệ KLTN (loại trừ nhóm do mình hướng dẫn)',
    description:
      'Danh sách hội đồng tham gia, vai trò, thành viên và các ca bảo vệ đã loại bỏ nhóm do giảng viên trực tiếp hướng dẫn',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách phân công hội đồng thành công' })
  @Get('me/committee-assignments')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  getLecturerCommitteeAssignments(@CurrentUser() user: { id: string }) {
    return this.usersService.getLecturerCommitteeAssignments(user.id);
  }

  @ApiOperation({
    summary: 'Lấy danh sách Giảng viên phản biện khả dụng cho một nhóm (loại trừ GVHD và người đã đủ tải)',
    description: 'Hỗ trợ tính toán định mức tải, loại trừ GVHD và gợi ý ghép cặp giảng viên để xếp lịch phòng',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách giảng viên phản biện khả dụng thành công' })
  @Get('available-reviewers')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  getAvailableReviewers(@Query('groupId') groupId: string) {
    return this.usersService.getAvailableReviewers(groupId);
  }

  @ApiOperation({
    summary: 'Lấy danh sách các cặp Giảng viên phản biện đã cấu hình',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách cặp phản biện thành công' })
  @Get('reviewer-pairs')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  getReviewerPairs(@Query('semesterId') semesterId?: string) {
    return this.usersService.getReviewerPairs(semesterId);
  }

  @ApiOperation({
    summary: 'Lưu cấu hình các cặp Giảng viên phản biện cho học kỳ',
  })
  @ApiResponse({ status: 200, description: 'Lưu cấu hình cặp phản biện thành công' })
  @Post('reviewer-pairs')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  saveReviewerPairs(@Body() body: { semesterId: string; pairs: any[] }) {
    return this.usersService.saveReviewerPairs(body.semesterId, body.pairs);
  }
}

