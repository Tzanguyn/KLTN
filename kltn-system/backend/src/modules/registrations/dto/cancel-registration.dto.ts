import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelRegistrationDto {
  @ApiPropertyOptional({ description: 'Lý do hủy / rút đơn đăng ký đề tài' })
  @IsOptional()
  @IsString()
  reason?: string;
}

