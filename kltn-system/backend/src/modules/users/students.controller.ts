import { Body, Controller, Get, Put, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Lấy thông tin cá nhân của sinh viên hiện tại',
    description: 'Trả về thông tin hồ sơ, thông tin liên lạc (SĐT, email cá nhân, địa chỉ) và trạng thái điều kiện KLTN',
  })
  @ApiResponse({ status: 200, description: 'Lấy thông tin thành công' })
  @Get('me')
  @Roles(RoleCode.SINH_VIEN)
  getMyProfile(@CurrentUser() user: { id: string }) {
    return this.usersService.getStudentProfile(user.id);
  }

  @ApiOperation({
    summary: 'Xem hồ sơ KLTN của sinh viên hiện tại',
    description: 'Trả về toàn bộ thông tin đề tài đang thực hiện, GVHD, thành viên nhóm, lịch sử nộp bài, lịch sử trao đổi và trạng thái KLTN hiện tại',
  })
  @ApiResponse({ status: 200, description: 'Lấy thông tin hồ sơ KLTN thành công' })
  @Get('me/kltn-profile')
  @Roles(RoleCode.SINH_VIEN)
  getKltnProfile(@CurrentUser() user: { id: string }) {
    return this.usersService.getKltnProfile(user.id);
  }

  @ApiOperation({
    summary: 'Xem tiến độ KLTN & Danh sách Deadline quan trọng',
    description: 'Trả về checklist / milestones, percentComplete, danh sách deadline quan trọng (nộp giữa kỳ, xác nhận giữa kỳ, nộp cuối, phản biện, bảo vệ) và trạng thái từng mốc',
  })
  @ApiResponse({ status: 200, description: 'Lấy thông tin tiến độ thành công' })
  @Get('me/progress')
  @Roles(RoleCode.SINH_VIEN)
  getMyProgress(@CurrentUser() user: { id: string }) {
    return this.usersService.getStudentProgress(user.id);
  }

  @ApiOperation({
    summary: 'Xem phân công phản biện – lịch bảo vệ – điểm chi tiết',
    description:
      'Trả về danh sách GVPB, thông tin lịch bảo vệ và bảng điểm chi tiết (GVHD, GVPB, Hội đồng, điểm tổng kết và kết quả cuối cùng). Chỉ hiển thị khi đã được phân công hoặc điểm đã công bố.',
  })
  @ApiResponse({ status: 200, description: 'Lấy thông tin phân công phản biện, lịch bảo vệ và điểm thành công' })
  @Get('me/defense-info')
  @Roles(RoleCode.SINH_VIEN)
  getMyDefenseInfo(@CurrentUser() user: { id: string }) {
    return this.usersService.getDefenseInfo(user.id);
  }

  @ApiOperation({
    summary: 'Cập nhật thông tin liên lạc cá nhân (Số điện thoại, Email cá nhân, Địa chỉ, ...)',
    description: 'Cho phép sinh viên cập nhật số điện thoại Việt Nam (10 số), email cá nhân, địa chỉ liên hệ và ghi AuditLog',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công, trả về thông tin hồ sơ mới' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ (sai định dạng email, SĐT hoặc gửi trường cấm)' })
  @Put('me')
  @Roles(RoleCode.SINH_VIEN)
  async updateMyProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateStudentProfileDto,
    @Req() request: Request,
  ) {
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      request.socket.remoteAddress ||
      '127.0.0.1';
    const userAgent = (request.headers['user-agent'] as string) || '';

    return this.usersService.updateStudentProfile(user.id, dto, ip, userAgent);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân (hỗ trợ thêm method PATCH)' })
  @Patch('me')
  @Roles(RoleCode.SINH_VIEN)
  async patchMyProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateStudentProfileDto,
    @Req() request: Request,
  ) {
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      request.socket.remoteAddress ||
      '127.0.0.1';
    const userAgent = (request.headers['user-agent'] as string) || '';

    return this.usersService.updateStudentProfile(user.id, dto, ip, userAgent);
  }
}

