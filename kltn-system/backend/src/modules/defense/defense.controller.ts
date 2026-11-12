import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssignReviewerDto } from './dto/assign-reviewer.dto';
import { AssignReviewersDto } from './dto/assign-reviewers.dto';
import { AssignThirdReviewerDto } from './dto/assign-third-reviewer.dto';
import { AssignGroupsToCommitteeDto } from './dto/assign-groups-to-committee.dto';
import { ClassifyDefenseFormatsDto } from './dto/classify-defense-formats.dto';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { ScheduleDefenseDto } from './dto/schedule-defense.dto';
import { DefenseService } from './defense.service';

@ApiTags('defense')
@ApiBearerAuth()
@Controller('defense')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DefenseController {
  constructor(private readonly service: DefenseService) {}

  @Get('schedules')
  schedules(@Query('semesterId') semesterId?: string) {
    return this.service.schedules(semesterId);
  }

  @Get('reviewers')
  assignments() {
    return this.service.assignments();
  }

  @Get('assignments')
  assignmentsAlias() {
    return this.service.assignments();
  }

  @Get('committees')
  committees(@Query('departmentId') departmentId?: string) {
    return this.service.committees(departmentId);
  }

  @ApiOperation({
    summary: 'Lấy bảng phân luồng hình thức bảo vệ (Top 20% Hội đồng - 80% Poster theo điểm phản biện)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách và thống kê phân luồng đề tài' })
  @Get('classification')
  getClassification(
    @Query('semesterId') semesterId?: string,
    @Query('topPercentage') topPercentage?: number,
  ) {
    return this.service.getClassifiedDefenseFormats(semesterId, topPercentage);
  }

  @ApiOperation({
    summary: 'Lấy thông tin hình thức bảo vệ của một nhóm cụ thể',
  })
  @Get('group-classification/:groupId')
  getGroupClassification(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('semesterId') semesterId?: string,
  ) {
    return this.service.getGroupDefenseFormat(groupId, semesterId);
  }

  @ApiOperation({
    summary: 'Lưu chính thức kết quả phân luồng hình thức bảo vệ KLTN',
  })
  @ApiResponse({ status: 201, description: 'Đã lưu cấu hình phân luồng thành công' })
  @Post('classify-formats')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  classifyFormats(
    @CurrentUser() user: { id: string },
    @Body() dto: ClassifyDefenseFormatsDto,
  ) {
    return this.service.classifyAndSaveDefenseFormats(user.id, dto);
  }

  @Post('reviewers')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  assign(@CurrentUser() user: { id: string }, @Body() dto: AssignReviewerDto) {
    return this.service.assignReviewer(user.id, dto);
  }

  @Post('assignments')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  assignAlias(@CurrentUser() user: { id: string }, @Body() dto: AssignReviewerDto) {
    return this.service.assignReviewer(user.id, dto);
  }

  @Post('review-assignments')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  assignTwoReviewers(@CurrentUser() user: { id: string }, @Body() dto: AssignReviewersDto) {
    return this.service.assignTwoReviewers(user.id, dto);
  }

  @Post('review-assignments/third-reviewer')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  assignThirdReviewer(@CurrentUser() user: { id: string }, @Body() dto: AssignThirdReviewerDto) {
    return this.service.assignThirdReviewer(user.id, dto);
  }

  @Delete('review-assignments/third-reviewer/:groupId')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  removeThirdReviewer(@CurrentUser() user: { id: string }, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.service.removeThirdReviewer(user.id, groupId);
  }

  @Post('committees')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  committee(@Body() dto: CreateCommitteeDto) {
    return this.service.createCommittee(dto);
  }

  @Post('committees/:id/assign-groups')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  assignGroups(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) committeeId: string,
    @Body() dto: AssignGroupsToCommitteeDto,
  ) {
    return this.service.assignGroupsToCommittee(user.id, committeeId, dto);
  }

  @Delete('committees/:id')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  deleteCommittee(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) committeeId: string,
  ) {
    return this.service.deleteDefenseCommittee(user.id, committeeId);
  }

  @Post('schedules')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  schedule(@CurrentUser() user: { id: string }, @Body() dto: ScheduleDefenseDto) {
    return this.service.scheduleDefense(user.id, dto);
  }
}


