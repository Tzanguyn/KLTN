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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { SemesterQueryDto } from './dto/semester-query.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';
import { SetRegistrationPeriodDto } from './dto/set-registration-period.dto';
import { SetRegistrationConditionsDto } from './dto/set-registration-conditions.dto';
import { SemestersService } from './semesters.service';

@ApiTags('semesters')
@ApiBearerAuth()
@Controller('semesters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @ApiOperation({
    summary: 'Lấy danh sách các đợt KLTN',
    description:
      'Hỗ trợ tìm kiếm theo từ khóa (tên/mã), lọc theo năm học, trạng thái, và bộ môn. Trả về thông tin đầy đủ kèm các trường alias tiếng Việt.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách các đợt KLTN' })
  @Get()
  getSemesters(@Query() query: SemesterQueryDto) {
    return this.semestersService.findMany(query);
  }

  @ApiOperation({
    summary: 'Lấy thông tin chi tiết một đợt KLTN theo ID',
  })
  @ApiParam({ name: 'id', description: 'ID của đợt KLTN (UUID)' })
  @ApiResponse({ status: 200, description: 'Chi tiết đợt KLTN' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đợt KLTN' })
  @Get(':id')
  getSemesterById(@Param('id') id: string) {
    return this.semestersService.findById(id);
  }

  @ApiOperation({
    summary: 'Tạo đợt KLTN mới (Trưởng bộ môn / Quản lý bộ môn)',
    description:
      'Payload hỗ trợ cả trường tiếng Việt { tenHocKy, namHoc, thoiGianBatDau, thoiGianKetThuc, ... }. Tự động kiểm tra không trùng đợt (mã đợt, tên trong năm học, khoảng thời gian tổ chức).',
  })
  @ApiResponse({ status: 201, description: 'Tạo đợt KLTN thành công' })
  @ApiResponse({
    status: 400,
    description:
      'Lỗi trùng đợt (trùng mã, trùng tên trong năm học, trùng thời gian) hoặc thời gian không hợp lệ',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @Post()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  createSemester(
    @Body() dto: CreateSemesterDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.semestersService.create(dto, user?.id);
  }

  @ApiOperation({
    summary: 'Cập nhật đợt KLTN (Trưởng bộ môn / Quản lý bộ môn)',
    description:
      'Cập nhật thông tin đợt KLTN. Kiểm tra không trùng đợt với các đợt khác (loại trừ chính nó).',
  })
  @ApiParam({ name: 'id', description: 'ID của đợt KLTN (UUID)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Lỗi trùng đợt hoặc dữ liệu không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đợt KLTN' })
  @Patch(':id')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  updateSemester(
    @Param('id') id: string,
    @Body() dto: UpdateSemesterDto,
  ) {
    return this.semestersService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Xóa đợt KLTN (Trưởng bộ môn / Quản lý bộ môn)',
    description:
      'Chỉ cho phép xóa khi đợt KLTN chưa có đề tài, nhóm hoặc sinh viên đăng ký. Nếu đã có dữ liệu, cần chuyển trạng thái sang CLOSED hoặc ARCHIVED.',
  })
  @ApiParam({ name: 'id', description: 'ID của đợt KLTN (UUID)' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({
    status: 400,
    description: 'Không thể xóa đợt KLTN đã có dữ liệu liên kết',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đợt KLTN' })
  @Delete(':id')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  deleteSemester(@Param('id') id: string) {
    return this.semestersService.delete(id);
  }

  @ApiOperation({
    summary: 'Lấy thông tin và trạng thái thời gian đăng ký đề tài của đợt KLTN',
    description:
      'Trả về mốc thời gian mở/đóng đăng ký và cờ isRegistrationOpen chỉ định hệ thống có đang cho phép đăng ký đề tài hay không.',
  })
  @ApiParam({ name: 'id', description: 'ID của đợt KLTN (UUID)' })
  @ApiResponse({ status: 200, description: 'Thông tin thời gian đăng ký' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đợt KLTN' })
  @Get(':id/registration-period')
  getRegistrationPeriod(@Param('id') id: string) {
    return this.semestersService.getRegistrationPeriod(id);
  }

  @ApiOperation({
    summary: 'Cấu hình thời gian mở/đóng đăng ký đề tài theo đợt (Trưởng bộ môn / Quản lý)',
    description:
      'Nhận start và end (ISO date string) để thiết lập khoảng thời gian mở đăng ký đề tài KLTN. Hệ thống dùng thời gian này để enable/disable các chức năng đăng ký.',
  })
  @ApiParam({ name: 'id', description: 'ID của đợt KLTN (UUID)' })
  @ApiResponse({ status: 200, description: 'Cấu hình thời gian đăng ký thành công' })
  @ApiResponse({ status: 400, description: 'Thời gian bắt đầu phải trước thời gian kết thúc hoặc không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đợt KLTN' })
  @Put(':id/registration-period')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  setRegistrationPeriod(
    @Param('id') id: string,
    @Body() dto: SetRegistrationPeriodDto,
  ) {
    return this.semestersService.setRegistrationPeriod(id, dto);
  }

  @ApiOperation({
    summary: 'Lấy cấu hình điều kiện đăng ký KLTN của đợt',
    description:
      'Trả về các điều kiện như số tín chỉ tích lũy tối thiểu, điểm trung bình tối thiểu, danh sách môn tiên quyết và yêu cầu trạng thái đủ điều kiện.',
  })
  @ApiParam({ name: 'id', description: 'ID của đợt KLTN (UUID)' })
  @ApiResponse({ status: 200, description: 'Cấu hình điều kiện đăng ký' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đợt KLTN' })
  @Get(':id/registration-conditions')
  getRegistrationConditions(@Param('id') id: string) {
    return this.semestersService.getRegistrationConditions(id);
  }

  @ApiOperation({
    summary: 'Cấu hình điều kiện đăng ký KLTN theo đợt (Trưởng bộ môn / Quản lý)',
    description:
      'Cấu hình số tín chỉ tối thiểu (minCredits / soTinChiToiThieu), điểm TB (minGpa / diemTBToiThieu), môn tiên quyết (prerequisiteCourses / monTienQuyet). Hệ thống sẽ tự động kiểm tra khi sinh viên đăng ký.',
  })
  @ApiParam({ name: 'id', description: 'ID của đợt KLTN (UUID)' })
  @ApiResponse({ status: 200, description: 'Cấu hình điều kiện đăng ký thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đợt KLTN' })
  @Put(':id/registration-conditions')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  setRegistrationConditions(
    @Param('id') id: string,
    @Body() dto: SetRegistrationConditionsDto,
  ) {
    return this.semestersService.setRegistrationConditions(id, dto);
  }
}



