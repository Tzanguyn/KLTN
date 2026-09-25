import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProposalStatus } from '@prisma/client';

export class DecideTopicProposalDto {
  @ApiProperty({ enum: ['GV_DA_DUYET', 'TU_CHOI'], description: 'Quyết định của GVHD' })
  @IsEnum(['GV_DA_DUYET', 'TU_CHOI'], { message: 'Trạng thái phải là GV_DA_DUYET hoặc TU_CHOI' })
  status!: 'GV_DA_DUYET' | 'TU_CHOI';

  @ApiPropertyOptional({ description: 'Lý do từ chối hoặc nhận xét hướng dẫn' })
  @IsOptional()
  @IsString({ message: 'Lý do phải là chuỗi ký tự' })
  reason?: string;
}

