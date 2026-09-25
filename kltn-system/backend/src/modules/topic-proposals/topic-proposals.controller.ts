import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTopicProposalDto } from './dto/create-topic-proposal.dto';
import { DecideTopicProposalDto } from './dto/decide-topic-proposal.dto';
import { TopicProposalsService } from './topic-proposals.service';

@ApiTags('topic-proposals')
@ApiBearerAuth()
@Controller('topic-proposals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TopicProposalsController {
  constructor(private readonly service: TopicProposalsService) {}

  @Post()
  @Roles(RoleCode.SINH_VIEN)
  @ApiOperation({ summary: 'Sinh viên gửi đề xuất đề tài mới cho GVHD' })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTopicProposalDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Get('me')
  @Roles(RoleCode.SINH_VIEN)
  @ApiOperation({ summary: 'Sinh viên xem danh sách đề xuất của mình' })
  findMyProposals(@CurrentUser() user: { id: string }) {
    return this.service.findMyProposals(user.id);
  }

  @Get('lecturer')
  @Roles(RoleCode.GIANG_VIEN)
  @ApiOperation({ summary: 'Giảng viên xem danh sách đề xuất gửi tới mình' })
  findLecturerProposals(@CurrentUser() user: { id: string }) {
    return this.service.findLecturerProposals(user.id);
  }

  @Patch(':id/decision')
  @Roles(RoleCode.GIANG_VIEN)
  @ApiOperation({ summary: 'Giảng viên xét duyệt hoặc từ chối đề xuất' })
  decide(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: DecideTopicProposalDto,
  ) {
    return this.service.decide(id, user.id, dto);
  }
}

