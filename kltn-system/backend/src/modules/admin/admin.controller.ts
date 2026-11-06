import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode, UserStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ResetPasswordAdminDto,
  UpdateUserDto,
  UpdateUserStatusDto,
} from './dto/update-user.dto';
import { BatchCreateUserDto } from './dto/batch-create-user.dto';
import { UpdateSystemStatusDto } from './dto/system-status.dto';
import { UpdateModuleSwitchesDto } from './dto/module-switches.dto';
import { TransferLeadershipDto } from './dto/transfer-leadership.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'Lấy số liệu thống kê tổng quan hệ thống' })
  @Get('stats')
  @Roles(RoleCode.ADMIN)
  getStats() {
    return this.adminService.getDashboardStats();
  }

  @ApiOperation({ summary: 'Lấy thông tin nhân sự lãnh đạo bộ môn (1 Trưởng BM, 1 Quản lý BM)' })
  @Get('leadership')
  @Roles(RoleCode.ADMIN)
  getLeadership() {
    return this.adminService.getDepartmentLeadership();
  }

  @ApiOperation({ summary: 'Chuyển giao chức vụ Trưởng bộ môn hoặc Quản lý bộ môn cho nhân sự mới' })
  @ApiResponse({ status: 200, description: 'Chuyển giao chức vụ thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân sự kế nhiệm' })
  @Post('transfer-leadership')
  @Roles(RoleCode.ADMIN)
  transferLeadership(
    @Body() dto: TransferLeadershipDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminService.transferLeadershipRole(dto.role, dto.successorUserId, user?.id);
  }

  @ApiOperation({ summary: 'Lấy danh sách người dùng có tìm kiếm, lọc và phân trang' })
  @Get('users')
  @Roles(RoleCode.ADMIN)
  getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: RoleCode,
    @Query('status') status?: UserStatus,
  ) {
    return this.adminService.getUsers({ page, limit, search, role, status });
  }

  @ApiOperation({ summary: 'Xem thông tin chi tiết một tài khoản' })
  @Get('users/:id')
  @Roles(RoleCode.ADMIN)
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @ApiOperation({ summary: 'Tạo tài khoản người dùng mới' })
  @Post('users')
  @Roles(RoleCode.ADMIN)
  createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminService.createUser(dto, user?.id);
  }

  @ApiOperation({ summary: 'Tạo tài khoản người dùng hàng loạt' })
  @Post('users/batch')
  @Roles(RoleCode.ADMIN)
  batchCreateUsers(
    @Body() dto: BatchCreateUserDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminService.batchCreateUsers(dto, user?.id);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin tài khoản người dùng' })
  @Patch('users/:id')
  @Roles(RoleCode.ADMIN)
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminService.updateUser(id, dto, user?.id);
  }

  @ApiOperation({ summary: 'Khóa / Mở khóa / Đổi trạng thái tài khoản' })
  @Patch('users/:id/status')
  @Roles(RoleCode.ADMIN)
  updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminService.updateUserStatus(id, dto, user?.id);
  }

  @ApiOperation({ summary: 'Đặt lại mật khẩu cho tài khoản người dùng' })
  @Post('users/:id/reset-password')
  @Roles(RoleCode.ADMIN)
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordAdminDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminService.resetPassword(id, dto, user?.id);
  }

  @ApiOperation({ summary: 'Xóa tài khoản người dùng an toàn' })
  @Delete('users/:id')
  @Roles(RoleCode.ADMIN)
  deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminService.deleteUser(id, user?.id);
  }

  // ==========================================
  // ĐÓNG MỞ HỆ THỐNG & CÁC CỔNG CHỨC NĂNG
  // ==========================================

  @ApiOperation({ summary: 'Lấy trạng thái đóng / mở toàn hệ thống' })
  @Get('system-status')
  getSystemStatus() {
    return this.adminService.getSystemStatus();
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái đóng / mở toàn hệ thống (Bảo trì/Hoạt động)' })
  @Put('system-status')
  @Roles(RoleCode.ADMIN)
  updateSystemStatus(
    @Body() dto: UpdateSystemStatusDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminService.updateSystemStatus(dto, user?.id);
  }

  @ApiOperation({ summary: 'Lấy trạng thái đóng / mở các cổng chức năng KLTN' })
  @Get('modules-status')
  getModuleSwitches() {
    return this.adminService.getModuleSwitches();
  }

  @ApiOperation({ summary: 'Cấu hình đóng / mở các cổng chức năng KLTN' })
  @Put('modules-status')
  @Roles(RoleCode.ADMIN)
  updateModuleSwitches(
    @Body() dto: UpdateModuleSwitchesDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminService.updateModuleSwitches(dto, user?.id);
  }
}

