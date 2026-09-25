import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueryStatisticsDto } from './dto/query-statistics.dto';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@ApiBearerAuth()
@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatisticsController {
  constructor(private readonly service: StatisticsService) {}

  @ApiOperation({
    summary: 'Thống kê tình hình đăng ký KLTN & lập nhóm',
    description:
      'Trả về số liệu tổng hợp SV đủ điều kiện, đã đăng ký, chưa đăng ký, tình trạng duyệt đơn và danh sách nhóm theo trạng thái (FORMING, ACTIVE, CANCELLED) + danh sách SV chưa đăng ký.',
  })
  @ApiResponse({ status: 200, description: 'Lấy thống kê đăng ký thành công' })
  @Get('registration-status')
  @Roles(RoleCode.QUAN_LY_BO_MON, RoleCode.TRUONG_BO_MON, RoleCode.GIANG_VIEN)
  getRegistrationStatus(@Query() query: QueryStatisticsDto) {
    return this.service.getRegistrationStatus(query.semesterId);
  }

  @ApiOperation({
    summary: 'Thống kê tiến độ thực hiện KLTN tổng thể của các nhóm',
    description:
      'Trả về số liệu tổng hợp và danh sách nhóm phân loại theo 4 trạng thái tiến độ: Đã hoàn thành (HOAN_THANH), Đang thực hiện (DANG_THUC_HIEN), Quá hạn (QUA_HAN), Dừng (DUNG) kèm % tiến độ.',
  })
  @ApiResponse({ status: 200, description: 'Lấy thống kê tiến độ thành công' })
  @Get('progress')
  @Roles(RoleCode.QUAN_LY_BO_MON, RoleCode.TRUONG_BO_MON, RoleCode.GIANG_VIEN)
  getProgress(@Query() query: QueryStatisticsDto) {
    return this.service.getProgress(query.semesterId);
  }

  @ApiOperation({
    summary: 'Thống kê chi tiết theo 5 mốc tiến độ quan trọng',
    description:
      'Theo dõi 5 mốc: Nộp giữa kỳ, Đánh giá giữa kỳ, Nộp cuối & mã nguồn, Phản biện, Bảo vệ. Trả về số liệu hoàn thành/quá hạn và danh sách nhóm theo từng mốc.',
  })
  @ApiResponse({ status: 200, description: 'Lấy thống kê mốc tiến độ thành công' })
  @Get('milestones')
  @Roles(RoleCode.QUAN_LY_BO_MON, RoleCode.TRUONG_BO_MON, RoleCode.GIANG_VIEN)
  getMilestones(@Query() query: QueryStatisticsDto) {
    return this.service.getMilestones(query.semesterId);
  }

  @ApiOperation({
    summary: 'Báo cáo kết quả đánh giá giữa kỳ của các nhóm KLTN',
    description:
      'Trả về số liệu tổng hợp và danh sách nhóm theo 3 kết quả đánh giá giữa kỳ: Cho tiếp tục (CONTINUE), Dừng KLTN (STOPPED), Chờ đánh giá (PENDING).',
  })
  @ApiResponse({ status: 200, description: 'Lấy báo cáo kết quả giữa kỳ thành công' })
  @Get('midterm-results')
  @Roles(RoleCode.QUAN_LY_BO_MON, RoleCode.TRUONG_BO_MON, RoleCode.GIANG_VIEN)
  getMidtermResults(@Query() query: QueryStatisticsDto) {
    return this.service.getMidtermResults(query.semesterId);
  }

  @ApiOperation({
    summary: 'Thống kê khối lượng giảng viên (workload): số nhóm hướng dẫn / phản biện theo từng GV',
    description:
      'Trả về số nhóm hướng dẫn, số nhóm phản biện, số đề tài, số hội đồng tham gia, hạn mức tối đa, chỗ còn trống và cảnh báo quá tải của từng giảng viên.',
  })
  @ApiResponse({ status: 200, description: 'Lấy thống kê tải giảng viên thành công' })
  @Get('workload')
  @Roles(RoleCode.QUAN_LY_BO_MON, RoleCode.TRUONG_BO_MON, RoleCode.GIANG_VIEN)
  getWorkload(@Query() query: QueryStatisticsDto) {
    return this.service.getWorkload(query.semesterId);
  }
}

