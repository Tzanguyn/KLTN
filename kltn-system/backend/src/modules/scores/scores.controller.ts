import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ScoreDto } from './dto/score.dto';
import { ScoreChangeDto } from './dto/score-change.dto';
import { SubmitBatchScoresDto } from './dto/submit-batch-scores.dto';
import { ScoreUnlockRequestDto } from './dto/score-unlock-request.dto';
import { QueryScoresDto } from './dto/query-scores.dto';
import { ScoresService } from './scores.service';

@ApiTags('scores')
@ApiBearerAuth()
@Controller('scores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoresController {
  constructor(private readonly service: ScoresService) {}

  @Get()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN, RoleCode.SINH_VIEN)
  @ApiOperation({
    summary: 'Lấy bảng điểm tổng hợp theo học kỳ (xem điểm thành phần + tổng và cảnh báo khi điểm chưa đầy đủ)',
  })
  findScores(@CurrentUser() user: { id: string }, @Query() query: QueryScoresDto) {
    return this.service.findSemesterScores(query, user.id);
  }

  @Get('criteria')
  @ApiOperation({ summary: 'Lấy danh mục 10 tiêu chí đánh giá KLTN' })
  criteria() {
    return this.service.criteria();
  }

  @Get('scoring-forms/:topicId')
  @ApiOperation({ summary: 'Lấy dữ liệu biểu mẫu chấm điểm theo 10 tiêu chí' })
  form(
    @CurrentUser() user: { id: string },
    @Param('topicId') topicId: string,
    @Query('role') role?: string,
  ) {
    return this.service.getScoringForm(user.id, topicId, role);
  }

  @Get('change-requests')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu mở khóa sửa điểm' })
  requests(@Query('status') status?: string) {
    return this.service.requests(status);
  }

  @Get('groups/:groupId')
  @ApiOperation({ summary: 'Lấy bảng điểm theo nhóm' })
  group(@Param('groupId') groupId: string) {
    return this.service.groupScores(groupId);
  }

  @Get('groups/:groupId/pdf')
  @ApiOperation({ summary: 'Xuất PDF phiếu điểm theo nhóm' })
  async pdf(@Param('groupId') groupId: string, @Res() response: Response) {
    const file = await this.service.exportPdf(groupId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="score-${groupId}.pdf"`);
    response.send(file);
  }

  @Get(':topicId/export-pdf')
  @ApiOperation({ summary: 'Xuất PDF biểu mẫu chấm điểm KLTN đúng chuẩn in ký' })
  async exportPdf(
    @Param('topicId') topicId: string,
    @Query('role') role: string | undefined,
    @Res() response: Response,
  ) {
    const file = await this.service.exportPdf(topicId, role);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="phieu-danh-gia-${topicId}.pdf"`);
    response.send(file);
  }

  @Post()
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON)
  @ApiOperation({ summary: 'Nhập điểm (hỗ trợ cả 10 tiêu chí batch hoặc đơn lẻ)' })
  save(
    @CurrentUser() user: { id: string },
    @Body() body: any,
  ) {
    // Nếu body chứa mảng scores hoặc có topicId và scores -> Chấm điểm 10 tiêu chí (Batch)
    if (body.scores && Array.isArray(body.scores)) {
      return this.service.submitBatchScores(user.id, body as SubmitBatchScoresDto);
    }
    // Ngược lại nếu là legacy ScoreDto (criterionId)
    return this.service.upsert(user.id, body as ScoreDto);
  }

  @Post('batch')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON)
  @ApiOperation({ summary: 'Nhập điểm chi tiết 10 tiêu chí theo đợt' })
  saveBatch(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitBatchScoresDto,
  ) {
    return this.service.submitBatchScores(user.id, dto);
  }

  @Post(':topicId/unlock-request')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON)
  @ApiOperation({ summary: 'Gửi yêu cầu mở khóa sửa điểm cho đề tài' })
  unlockRequest(
    @CurrentUser() user: { id: string },
    @Param('topicId') topicId: string,
    @Body() dto: ScoreUnlockRequestDto,
  ) {
    return this.service.requestScoreUnlock(user.id, { ...dto, topicId });
  }

  @Post('change-requests')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON)
  @ApiOperation({ summary: 'Gửi đề xuất mở khóa sửa điểm' })
  request(@CurrentUser() user: { id: string }, @Body() dto: ScoreChangeDto) {
    return this.service.requestChange(user.id, dto);
  }

  @Patch('change-requests/:id')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Trưởng bộ môn duyệt hoặc từ chối yêu cầu mở khóa điểm' })
  review(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body('approved') approved: boolean,
  ) {
    return this.service.reviewChange(user.id, id, approved);
  }

  @Patch('groups/:groupId/unlock')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Trưởng bộ môn trực tiếp mở khóa điểm cho nhóm' })
  unlock(@Param('groupId') groupId: string) {
    return this.service.unlock(groupId);
  }
}
