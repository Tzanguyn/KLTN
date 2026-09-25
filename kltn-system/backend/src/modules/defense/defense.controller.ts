import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssignReviewerDto } from './dto/assign-reviewer.dto';
import { AssignReviewersDto } from './dto/assign-reviewers.dto';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { ScheduleDefenseDto } from './dto/schedule-defense.dto';
import { DefenseService } from './defense.service';
@ApiTags('defense') @ApiBearerAuth() @Controller('defense') @UseGuards(JwtAuthGuard, RolesGuard)
export class DefenseController {
	constructor(private readonly service: DefenseService) {}
	@Get('schedules') schedules(@Query('semesterId') semesterId?: string) { return this.service.schedules(semesterId); }
	@Get('reviewers') assignments() { return this.service.assignments(); }
	@Get('assignments') assignmentsAlias() { return this.service.assignments(); }
	@Get('committees') committees(@Query('departmentId') departmentId?: string) { return this.service.committees(departmentId); }
	@Post('reviewers') @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON) assign(@CurrentUser() user: { id: string }, @Body() dto: AssignReviewerDto) { return this.service.assignReviewer(user.id, dto); }
	@Post('assignments') @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON) assignAlias(@CurrentUser() user: { id: string }, @Body() dto: AssignReviewerDto) { return this.service.assignReviewer(user.id, dto); }
	@Post('review-assignments') @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON) assignTwoReviewers(@CurrentUser() user: { id: string }, @Body() dto: AssignReviewersDto) { return this.service.assignTwoReviewers(user.id, dto); }
	@Post('committees') @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON) committee(@Body() dto: CreateCommitteeDto) { return this.service.createCommittee(dto); }
	@Post('schedules') @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON) schedule(@CurrentUser() user: { id: string }, @Body() dto: ScheduleDefenseDto) { return this.service.scheduleDefense(user.id, dto); }
}

