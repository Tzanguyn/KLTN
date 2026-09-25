import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleHideTopicDto {
  @ApiProperty({ example: true, required: false, description: 'True để ẩn đề tài khỏi sinh viên, False để hiển thị lại' })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiProperty({ example: true, required: false, description: 'Ẩn đề tài (alias)' })
  @IsOptional()
  @IsBoolean()
  anDeTai?: boolean;
}

