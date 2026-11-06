import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateModuleSwitchesDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  registrationOpen?: boolean;

  @ApiPropertyOptional({ example: 'Đang mở đăng ký đề tài' })
  @IsOptional()
  @IsString()
  registrationNote?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  proposalOpen?: boolean;

  @ApiPropertyOptional({ example: 'Cho phép sinh viên & giảng viên đề xuất đề tài mới' })
  @IsOptional()
  @IsString()
  proposalNote?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  submissionOpen?: boolean;

  @ApiPropertyOptional({ example: 'Cổng nộp báo cáo tiến độ và khóa luận' })
  @IsOptional()
  @IsString()
  submissionNote?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  scoringOpen?: boolean;

  @ApiPropertyOptional({ example: 'Cổng chấm điểm bảo vệ' })
  @IsOptional()
  @IsString()
  scoringNote?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  scoreAppealOpen?: boolean;

  @ApiPropertyOptional({ example: 'Cổng gửi yêu cầu phúc khảo / điều chỉnh điểm' })
  @IsOptional()
  @IsString()
  scoreAppealNote?: string;

  @ApiPropertyOptional({ example: '2026-10-07T16:18:22.000Z' })
  @IsOptional()
  @IsString()
  updatedAt?: string;
}


