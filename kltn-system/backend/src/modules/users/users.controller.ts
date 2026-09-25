import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateEligibilityDto } from './dto/update-eligibility.dto';
import { UpdateQuotaDto } from './dto/update-quota.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @ApiOperation({ summary: 'Lấy thông tin profile cá nhân' })
  @Get('me')
  profile(@CurrentUser() user: { id: string }) {
    return this.service.profile(user.id);
  }

  @ApiOperation({ summary: 'Kiểm tra điều kiện đăng ký KLTN của sinh viên' })
  @Get('me/eligibility')
  eligibility(@CurrentUser() user: { id: string }) {
    return this.service.eligibility(user.id);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin profile cá nhân' })
  @Patch('me')
  update(@CurrentUser() user: { id: string }, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(user.id, dto);
  }

  @ApiOperation({ summary: 'Lấy danh sách tất cả giảng viên' })
  @Get('lecturers')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN, RoleCode.SINH_VIEN)
  lecturers() {
    return this.service.lecturers();
  }

  @ApiOperation({ summary: 'Lấy danh sách sinh viên có phân trang & tìm kiếm' })
  @Get('students')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  students(@Query() query: { page?: number; limit?: number; search?: string; eligible?: string }) {
    return this.service.students(query);
  }

  @ApiOperation({ summary: 'Cập nhật điều kiện tham gia KLTN của sinh viên' })
  @Patch('students/:id/eligibility')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  updateEligibility(@Param('id') id: string, @Body() dto: UpdateEligibilityDto) {
    return this.service.updateStudentEligibility(id, dto);
  }

  @ApiOperation({ summary: 'Cập nhật hạn mức số nhóm hướng dẫn tối đa của giảng viên' })
  @Patch('lecturers/:id/quota')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  updateQuota(@Param('id') id: string, @Body() dto: UpdateQuotaDto) {
    return this.service.updateLecturerQuota(id, dto);
  }
}
