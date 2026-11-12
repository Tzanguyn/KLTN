import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateDefenseCommitteeDto } from './dto/create-defense-committee.dto';
import { AssignGroupsToCommitteeDto } from './dto/assign-groups-to-committee.dto';
import { DefenseService } from './defense.service';

@ApiTags('defense-committees')
@ApiBearerAuth()
@Controller('defense-committees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DefenseCommitteesController {
  constructor(private readonly service: DefenseService) {}

  @ApiOperation({
    summary: 'Thành lập Hội đồng bảo vệ KLTN (kiểm tra thành viên tối thiểu và chống xung đột GVHD)',
    description: 'Tối thiểu 3 thành viên, tự động loại trừ và chặn GVHD chấm nhóm do mình hướng dẫn.',
  })
  @ApiResponse({ status: 201, description: 'Thành lập hội đồng bảo vệ thành công' })
  @ApiResponse({ status: 400, description: 'Không đủ thành viên tối thiểu hoặc xung đột vai trò GVHD' })
  @Post()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  createCommittee(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateDefenseCommitteeDto,
  ) {
    return this.service.createDefenseCommittee(user.id, dto);
  }

  @ApiOperation({
    summary: 'Lấy danh sách các Hội đồng bảo vệ KLTN theo học kỳ',
  })
  @Get()
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  listCommittees(@Query('semesterId') semesterId?: string) {
    return this.service.listDefenseCommittees(semesterId);
  }

  @ApiOperation({
    summary: 'Phân các nhóm đề tài cho Hội đồng bảo vệ KLTN đã chọn',
    description: 'Sau khi hội đồng được thành lập, trưởng bộ môn chọn hội đồng và phân các nhóm cho hội đồng đó. Tự động kiểm tra xung đột vai trò GVHD và điều kiện bảo vệ.',
  })
  @ApiResponse({ status: 200, description: 'Phân nhóm cho hội đồng thành công' })
  @ApiResponse({ status: 400, description: 'Xung đột vai trò GVHD hoặc nhóm không đủ điều kiện bảo vệ' })
  @Post(':id/assign-groups')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  assignGroups(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) committeeId: string,
    @Body() dto: AssignGroupsToCommitteeDto,
  ) {
    return this.service.assignGroupsToCommittee(user.id, committeeId, dto);
  }

  @ApiOperation({
    summary: 'Xóa Hội đồng bảo vệ KLTN',
  })
  @Delete(':id')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  deleteCommittee(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) committeeId: string,
  ) {
    return this.service.deleteDefenseCommittee(user.id, committeeId);
  }

  @ApiOperation({
    summary: 'Lấy danh sách giảng viên khả dụng để lập hội đồng (kiểm tra xung đột với các nhóm được chọn)',
  })
  @Get('available-members')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  getAvailableMembers(
    @Query('semesterId') semesterId: string,
    @Query('groupIds') groupIds?: string | string[],
  ) {
    const ids = Array.isArray(groupIds)
      ? groupIds
      : groupIds
      ? groupIds.split(',').filter(Boolean)
      : undefined;
    return this.service.getAvailableCommitteeMembers(semesterId, ids);
  }
}

