import { ApiPropertyOptional } from '@nestjs/swagger';
import { GroupStatus, MidtermStatus } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateGroupDto {
  @ApiPropertyOptional({ description: 'Tên nhóm KLTN' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: GroupStatus, description: 'Trạng thái nhóm (FORMING, ACTIVE, COMPLETED, CANCELLED)' })
  @IsOptional()
  @IsEnum(GroupStatus)
  status?: GroupStatus;

  @ApiPropertyOptional({ description: 'ID đề tài gán cho nhóm' })
  @IsOptional()
  @IsUUID()
  topicId?: string;

  @ApiPropertyOptional({ description: 'ID sinh viên được chỉ định làm nhóm trưởng' })
  @IsOptional()
  @IsUUID()
  leaderId?: string;

  @ApiPropertyOptional({ description: 'Danh sách ID sinh viên thành viên (cập nhật đồng bộ)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds?: string[];

  @ApiPropertyOptional({ description: 'ID sinh viên cần thêm vào nhóm' })
  @IsOptional()
  @IsUUID()
  addStudentId?: string;

  @ApiPropertyOptional({ description: 'ID sinh viên cần xóa khỏi nhóm' })
  @IsOptional()
  @IsUUID()
  removeStudentId?: string;

  @ApiPropertyOptional({ enum: MidtermStatus, description: 'Trạng thái đánh giá giữa kỳ' })
  @IsOptional()
  @IsEnum(MidtermStatus)
  midtermStatus?: MidtermStatus;

  @ApiPropertyOptional({ description: 'Ghi chú đánh giá giữa kỳ' })
  @IsOptional()
  @IsString()
  midtermNote?: string;
}

