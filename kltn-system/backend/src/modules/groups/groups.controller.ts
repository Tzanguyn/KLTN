import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QuerySubmissionsDto } from '../progress/dto/query-submissions.dto';
import { ProgressService } from '../progress/progress.service';
import { AddMemberDto } from './dto/add-member.dto';
import { MidtermDto } from './dto/midterm.dto';
import { QueryGroupsDto } from './dto/query-groups.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(
    private readonly service: GroupsService,
    private readonly progressService: ProgressService,
  ) {}

  @ApiOperation({
    summary: 'Tạo nhóm KLTN mới cho đề tài (Sinh viên hoặc Giảng viên)',
  })
  @ApiResponse({ status: 201, description: 'Tạo nhóm thành công' })
  @Post()
  @Roles(RoleCode.SINH_VIEN, RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  create(@CurrentUser() user: { id: string }, @Body() dto: any) {
    return this.service.createGroup(user.id, dto);
  }

  @ApiOperation({
    summary: 'Sinh viên tham gia / chọn nhóm KLTN của đề tài đã đăng ký',
  })
  @ApiResponse({ status: 200, description: 'Tham gia nhóm thành công' })
  @Post(':id/join')
  @Roles(RoleCode.SINH_VIEN)
  join(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.joinGroup(user.id, id);
  }

  @ApiOperation({
    summary: 'Lấy danh sách nhóm KLTN (hỗ trợ lọc semesterId, readyForReview, status, search)',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách nhóm thành công' })
  @Get()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN, RoleCode.SINH_VIEN)
  findGroups(@CurrentUser() user: { id: string }, @Query() query: QueryGroupsDto) {
    return this.service.findGroups(query, user.id);
  }

  @ApiOperation({
    summary: 'Lấy danh sách nhóm của người dùng hiện tại (GV hướng dẫn hoặc SV thành viên)',
  })
  @Get('mine')
  mine(@CurrentUser() user: { id: string }) {
    return this.service.list(user.id);
  }

  @ApiOperation({
    summary: 'Lấy thông tin chi tiết một nhóm KLTN theo ID',
  })
  @ApiResponse({ status: 200, description: 'Lấy thông tin nhóm thành công' })
  @Get(':id')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN, RoleCode.SINH_VIEN)
  findById(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.findById(id, user.id);
  }

  @ApiOperation({
    summary: 'Cập nhật thông tin nhóm KLTN khi được phép (Trưởng BM, Quản lý BM, GVHD hoặc Trưởng nhóm SV)',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thông tin nhóm thành công' })
  @Patch(':id')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN, RoleCode.SINH_VIEN)
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @ApiOperation({
    summary: 'Thêm thành viên vào nhóm KLTN',
  })
  @Post(':id/members')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.SINH_VIEN)
  addMember(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(user.id, id, dto);
  }

  @ApiOperation({
    summary: 'Xóa sinh viên khỏi nhóm KLTN (GVHD, Quản lý BM hoặc Trưởng nhóm khi FORMING)',
  })
  @Delete(':id/members/:studentId')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.SINH_VIEN)
  removeMember(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    return this.service.removeMember(user.id, id, studentId);
  }

  @ApiOperation({
    summary: 'Chuyển sinh viên sang nhóm KLTN khác (GVHD của 2 nhóm hoặc Quản lý BM)',
  })
  @Post(':id/transfer-member')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  transferMember(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: { studentId: string; targetGroupId: string },
  ) {
    return this.service.transferMember(user.id, id, dto);
  }

  @Patch(':id/midterm')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  midterm(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: MidtermDto,
  ) {
    return this.service.midterm(user.id, id, dto);
  }

  @ApiOperation({
    summary: 'Lấy danh sách bài nộp của nhóm (hỗ trợ lọc theo thời gian và trạng thái)',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách bài nộp của nhóm thành công' })
  @Get(':id/submissions')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.SINH_VIEN)
  submissions(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query() query: QuerySubmissionsDto,
  ) {
    return this.progressService.findSubmissions(user.id, { ...query, groupId: id });
  }
}
