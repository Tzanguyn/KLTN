import { ApiPropertyOptional } from '@nestjs/swagger';
import { GroupStatus } from '@prisma/client';
import { IsBooleanString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryGroupsDto {
  @ApiPropertyOptional({ description: 'Lọc nhóm đủ điều kiện phản biện (midtermStatus = CONTINUE)' })
  @IsOptional()
  @IsBooleanString()
  readyForReview?: string;

  @ApiPropertyOptional({ description: 'Lọc nhóm đủ điều kiện bảo vệ (midtermStatus = CONTINUE, status != CANCELLED)' })
  @IsOptional()
  @IsBooleanString()
  readyForDefense?: string;

  @ApiPropertyOptional({ description: 'ID học kỳ / đợt KLTN' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (mã nhóm, tên nhóm, tên đề tài)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: GroupStatus, description: 'Trạng thái nhóm (FORMING, ACTIVE, COMPLETED, CANCELLED)' })
  @IsOptional()
  @IsEnum(GroupStatus)
  status?: GroupStatus;

  @ApiPropertyOptional({ description: 'Lọc theo ID đề tài' })
  @IsOptional()
  @IsUUID()
  topicId?: string;
}
