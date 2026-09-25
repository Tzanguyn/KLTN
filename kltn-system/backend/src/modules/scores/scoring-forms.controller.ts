import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ScoresService } from './scores.service';

@ApiTags('scoring-forms')
@ApiBearerAuth()
@Controller('scoring-forms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoringFormsController {
  constructor(private readonly service: ScoresService) {}

  @Get(':topicId')
  @ApiOperation({ summary: 'Lấy dữ liệu biểu mẫu chấm điểm theo 10 tiêu chí cho đề tài' })
  getScoringForm(
    @CurrentUser() user: { id: string },
    @Param('topicId') topicId: string,
    @Query('role') role?: string,
  ) {
    return this.service.getScoringForm(user.id, topicId, role);
  }
}

