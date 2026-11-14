import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTopicDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tenDeTai?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  moTa?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  yeuCauSinhVien?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  yeuCau?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  technologies?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  congNghe?: string;

  @ApiProperty({ required: false, description: 'Số lượng sinh viên tối đa (từ 1 đến 2)' })
  @IsOptional()
  @IsInt({ message: 'Số lượng sinh viên phải là số nguyên' })
  @Min(1, { message: 'Số lượng sinh viên tối thiểu của mỗi nhóm là 1 sinh viên' })
  @Max(2, { message: 'Số lượng sinh viên tối đa của mỗi nhóm là 2 sinh viên' })
  capacity?: number;

  @ApiProperty({ required: false, description: 'Số lượng sinh viên tối đa (tiếng Việt) (từ 1 đến 2)' })
  @IsOptional()
  @IsInt({ message: 'Số lượng sinh viên phải là số nguyên' })
  @Min(1, { message: 'Số lượng sinh viên tối thiểu của mỗi nhóm là 1 sinh viên' })
  @Max(2, { message: 'Số lượng sinh viên tối đa của mỗi nhóm là 2 sinh viên' })
  soLuongToiDa?: number;

  @ApiProperty({ required: false, description: 'Trạng thái ẩn đề tài khỏi danh sách sinh viên' })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiProperty({ required: false, description: 'Ẩn đề tài (alias)' })
  @IsOptional()
  @IsBoolean()
  anDeTai?: boolean;
}
