import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DefenseAiService } from './defense-ai.service';
import { RecommendReviewersDto } from './dto/recommend-reviewers.dto';
import { RecommendCommitteeDto } from './dto/recommend-committee.dto';

@ApiTags('defense-ai')
@ApiBearerAuth()
@Controller('defense/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DefenseAiController {
  constructor(private readonly defenseAiService: DefenseAiService) {}

  @ApiOperation({
    summary: 'AI Đề xuất Giảng viên phản biện (GVPB) phù hợp với đề tài KLTN',
    description:
      'Phân tích tiêu đề, tóm tắt, mục tiêu và công nghệ đề tài để xếp hạng giảng viên phản biện phù hợp nhất. Tự động loại trừ GVHD và kiểm tra hạn mức tải.',
  })
  @ApiResponse({ status: 200, description: 'Đề xuất danh sách GVPB và cặp GVPB tối ưu thành công' })
  @Post('recommend-reviewers')
  @Roles(RoleCode.ADMIN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  recommendReviewers(@Body() dto: RecommendReviewersDto) {
    return this.defenseAiService.recommendReviewers(dto);
  }

  @ApiOperation({
    summary: 'AI Đề xuất thành phần Hội đồng bảo vệ KLTN phù hợp với danh sách đề tài',
    description:
      'Đề xuất Chủ tịch, Thư ký, Ủy viên phản biện và Ủy viên. Tự động loại trừ toàn bộ GVHD của các nhóm được chọn để chống xung đột vai trò.',
  })
  @ApiResponse({ status: 200, description: 'Đề xuất thành phần hội đồng bảo vệ thành công' })
  @Post('recommend-committee')
  @Roles(RoleCode.ADMIN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  recommendCommittee(@Body() dto: RecommendCommitteeDto) {
    return this.defenseAiService.recommendCommittee(dto);
  }

  @ApiOperation({
    summary: 'Kiểm tra trạng thái kết nối của AI Engine (Gemini hoặc Heuristic Fallback)',
  })
  @Get('status')
  @Roles(RoleCode.ADMIN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  getStatus() {
    return this.defenseAiService.getAiStatus();
  }
}
