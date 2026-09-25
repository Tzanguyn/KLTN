import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MidtermEvaluationDto } from './dto/midterm-evaluation.dto';
import { MidtermEvaluationsService } from './midterm-evaluations.service';

@ApiTags('midterm-evaluations')
@ApiBearerAuth()
@Controller('midterm-evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MidtermEvaluationsController {
  constructor(private readonly service: MidtermEvaluationsService) {}

  @Get('my-groups')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Lấy danh sách nhóm hướng dẫn của GV kèm trạng thái đánh giá giữa kỳ' })
  myGroups(@CurrentUser() user: { id: string }) {
    return this.service.getMyGroups(user.id);
  }

  @Post()
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'GVHD xác nhận kết quả đánh giá giữa kỳ: CHO_LAM_TIEP hoặc DUNG_DE_TAI' })
  evaluate(@CurrentUser() user: { id: string }, @Body() dto: MidtermEvaluationDto) {
    return this.service.evaluate(user.id, dto);
  }
}

