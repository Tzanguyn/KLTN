import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppointmentStatus, RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ProposeTimeDto } from './dto/propose-time.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentsService } from './appointments.service';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @ApiOperation({
    summary: 'Lấy danh sách lịch hẹn của người dùng hiện tại (hỗ trợ lọc thời gian, trạng thái, hình thức)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách lịch hẹn' })
  @Get('my')
  getMy(@CurrentUser() user: { id: string }, @Query() query: QueryAppointmentDto) {
    return this.service.getMy(user.id, query);
  }

  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn của người dùng hiện tại (alias /me)' })
  @Get('me')
  getMe(@CurrentUser() user: { id: string }, @Query() query: QueryAppointmentDto) {
    return this.service.getMy(user.id, query);
  }

  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn (alias /)' })
  @Get()
  list(@CurrentUser() user: { id: string }, @Query() query: QueryAppointmentDto) {
    return this.service.getMy(user.id, query);
  }

  @ApiOperation({
    summary: 'Tạo lịch hẹn mới với sinh viên hoặc nhóm KLTN',
    description:
      'Hỗ trợ đặt theo studentIds[] hoặc groupId, hình thức ONLINE/OFFLINE, gửi thông báo Realtime/Email cho SV',
  })
  @ApiResponse({ status: 201, description: 'Tạo lịch hẹn thành công' })
  @Post()
  @Roles(RoleCode.SINH_VIEN, RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateAppointmentDto) {
    return this.service.create(user.id, dto);
  }

  @ApiOperation({
    summary: 'Chỉnh sửa / cập nhật lịch hẹn',
    description: 'Cập nhật thời gian, hình thức, phòng/link họp, nội dung và gửi thông báo chỉnh sửa cho SV',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật lịch hẹn thành công' })
  @Patch(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @ApiOperation({
    summary: 'Hủy lịch hẹn',
    description: 'Đổi trạng thái lịch hẹn sang CANCELLED và gửi thông báo hủy lịch cho sinh viên',
  })
  @ApiResponse({ status: 200, description: 'Hủy lịch hẹn thành công' })
  @Delete(':id')
  cancel(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.cancel(user.id, id);
  }

  @ApiOperation({
    summary: 'Gửi thông báo nhắc nhở lịch hẹn',
    description: 'Gửi thông báo Realtime/Email nhắc nhở sinh viên và người tham gia về cuộc hẹn sắp diễn ra',
  })
  @ApiResponse({ status: 200, description: 'Gửi nhắc nhở thành công' })
  @Post(':id/remind')
  @HttpCode(HttpStatus.OK)
  remind(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.remind(user.id, id);
  }

  @ApiOperation({ summary: 'Xác nhận lịch hẹn' })
  @ApiResponse({ status: 200, description: 'Xác nhận lịch hẹn thành công' })
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.confirm(user.id, id);
  }

  @ApiOperation({ summary: 'Đề xuất thời gian mới cho lịch hẹn (nếu giảng viên cho phép)' })
  @ApiResponse({ status: 200, description: 'Đề xuất thời gian thành công' })
  @Post(':id/propose-time')
  @HttpCode(HttpStatus.OK)
  proposeTime(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ProposeTimeDto,
  ) {
    return this.service.proposeTime(user.id, id, dto);
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái lịch hẹn' })
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body('status') status: AppointmentStatus,
  ) {
    return this.service.updateStatus(user.id, id, status);
  }
}
