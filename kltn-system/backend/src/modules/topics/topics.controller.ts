import { Body, Controller, Delete, Get, Patch, Post, Param, Query, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTopicDto } from './dto/create-topic.dto';
import { ReviewTopicDto } from './dto/review-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { ToggleHideTopicDto } from './dto/toggle-hide-topic.dto';
import { AddStudentToTopicDto } from './dto/add-student-to-topic.dto';
import { ApproveTopicDto } from './dto/approve-topic.dto';
import { RejectTopicDto } from './dto/reject-topic.dto';
import { RequestChangesTopicDto } from './dto/request-changes-topic.dto';
import { TopicsService } from './topics.service';

@ApiTags('topics')
@ApiBearerAuth()
@Controller('topics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TopicsController {
  constructor(private readonly service: TopicsService) {}

  @ApiOperation({
    summary: 'Lấy danh sách đề tài (lọc theo đề tài đã duyệt, còn chỗ trống, GVHD, chuyên ngành, từ khóa, phân trang)',
    description: 'Hỗ trợ các filter: status (APPROVED), hasSlot (true), keyword, gvId, chuyenNganh, page, limit',
  })
  @Get()
  list(@Query() query: any, @CurrentUser() user?: { id: string }) {
    return this.service.list(query, user?.id);
  }

  @ApiOperation({ summary: 'Lấy danh sách đề tài của Giảng viên' })
  @Get('my')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON)
  my(@CurrentUser() user: { id: string }) {
    return this.service.mine(user.id);
  }

  @ApiOperation({ summary: 'Lấy danh sách đề tài do tôi tạo (alias)' })
  @Get('mine')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.SINH_VIEN)
  mine(@CurrentUser() user: { id: string }) {
    return this.service.mine(user.id);
  }

  @ApiOperation({ summary: 'Xem chi tiết đề tài' })
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @ApiOperation({ summary: 'Xem lịch sử phê duyệt của một đề tài' })
  @Get(':id/approvals')
  approvals(@Param('id') id: string) {
    return this.service.approvalHistory(id);
  }

  @ApiOperation({ summary: 'Đăng ký hoặc đề xuất đề tài mới (Giảng viên)' })
  @Post()
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateTopicDto) {
    return this.service.create(user.id, dto);
  }

  @ApiOperation({ summary: 'Ẩn hoặc hiện đề tài đã duyệt khỏi danh sách hiển thị cho sinh viên (Giảng viên)' })
  @Patch(':id/hide')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON)
  hide(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ToggleHideTopicDto,
  ) {
    return this.service.toggleHide(user.id, id, dto);
  }

  @ApiOperation({ summary: 'Ẩn hoặc hiện đề tài khỏi danh sách sinh viên (alias visibility)' })
  @Patch(':id/visibility')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON)
  visibility(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ToggleHideTopicDto,
  ) {
    return this.service.toggleHide(user.id, id, dto);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin đề tài của mình' })
  @Patch(':id')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.SINH_VIEN)
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateTopicDto) {
    return this.service.update(user.id, id, dto);
  }

  @ApiOperation({ summary: 'Hủy/Lưu trữ đề tài của mình' })
  @Delete(':id')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.SINH_VIEN)
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }

  @ApiOperation({ summary: 'Xem danh sách sinh viên đăng ký đề tài kèm thông tin liên lạc' })
  @Get(':id/registrations')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  getRegistrations(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.service.getRegistrations(user.id, id);
  }

  @ApiOperation({ summary: 'Giảng viên chủ động thêm sinh viên vào đề tài' })
  @Post(':id/add-student')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON)
  addStudent(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: AddStudentToTopicDto,
  ) {
    return this.service.addStudent(user.id, id, dto);
  }

  @ApiOperation({ summary: 'Phê duyệt hoặc từ chối đề tài (Trưởng bộ môn / Quản lý)' })
  @Post(':id/review')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  review(@Param('id') id: string, @CurrentUser() user: { id: string }, @Body() dto: ReviewTopicDto) {
    return this.service.review(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Phê duyệt đề tài (Trưởng bộ môn)' })
  @Post(':id/approve')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ApproveTopicDto,
  ) {
    return this.service.approve(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Từ chối đề tài kèm lý do (Trưởng bộ môn)' })
  @Post(':id/reject')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  reject(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RejectTopicDto,
  ) {
    return this.service.reject(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Yêu cầu chỉnh sửa đề tài (Trưởng bộ môn) -> CAN_CAP_NHAT' })
  @Post(':id/request-changes')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  requestChanges(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RequestChangesTopicDto,
  ) {
    return this.service.requestChanges(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Yêu cầu chỉnh sửa đề tài (alias) -> CAN_CAP_NHAT' })
  @Post(':id/request-update')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  requestUpdate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RequestChangesTopicDto,
  ) {
    return this.service.requestChanges(id, user.id, dto);
  }
}
