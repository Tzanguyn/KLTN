import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationDecisionDto } from './dto/decision.dto';
import { CancelRegistrationDto } from './dto/cancel-registration.dto';
import { QueryRegistrationsDto } from './dto/query-registrations.dto';
import { RegistrationsService } from './registrations.service';

@ApiTags('registrations') @ApiBearerAuth() @Controller('registrations') @UseGuards(JwtAuthGuard, RolesGuard)
export class RegistrationsController {
  constructor(private readonly service: RegistrationsService) {}
  @Post() @Roles(RoleCode.SINH_VIEN) create(@CurrentUser() user: { id: string }, @Body() dto: CreateRegistrationDto) { return this.service.create(user.id, dto); }
  @Get('mine') @Roles(RoleCode.SINH_VIEN) mine(@CurrentUser() user: { id: string }) { return this.service.mine(user.id); }
  @Get() @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN) list(@Query() query: QueryRegistrationsDto) { return this.service.list(query); }
  @Patch(':id/decision') @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN) decide(@Param('id') id: string, @Body() dto: RegistrationDecisionDto) { return this.service.decide(id, dto); }
  @Post(':id/cancel') @Roles(RoleCode.SINH_VIEN) cancel(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto?: CancelRegistrationDto) { return this.service.cancel(user.id, id, dto); }
  @Patch(':id/withdraw') @Roles(RoleCode.SINH_VIEN) withdraw(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto?: CancelRegistrationDto) { return this.service.withdraw(user.id, id, dto); }
}
