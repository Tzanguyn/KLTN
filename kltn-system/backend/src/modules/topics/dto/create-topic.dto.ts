import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTopicDto {
  @ApiProperty({ example: 'Nghiên cứu thị giác máy tính trong nhận diện biển số xe', description: 'Tên đề tài KLTN', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Nghiên cứu thị giác máy tính trong nhận diện biển số xe', description: 'Tên đề tài KLTN (tiếng Việt)', required: false })
  @IsOptional()
  @IsString()
  tenDeTai?: string;

  @ApiProperty({ example: 'Tóm tắt nội dung đề tài', required: false })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ example: 'Tóm tắt nội dung đề tài (tiếng Việt)', required: false })
  @IsOptional()
  @IsString()
  moTa?: string;

  @ApiProperty({ example: 'Mục tiêu nghiên cứu', required: false })
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiProperty({ example: 'Yêu cầu đối với sinh viên thực hiện đề tài', required: false })
  @IsOptional()
  @IsString()
  yeuCauSinhVien?: string;

  @ApiProperty({ example: 'Yêu cầu đối với sinh viên thực hiện đề tài', required: false })
  @IsOptional()
  @IsString()
  yeuCau?: string;

  @ApiProperty({ example: 'Python, OpenCV, YOLO, PyTorch', required: false })
  @IsOptional()
  @IsString()
  technologies?: string;

  @ApiProperty({ example: 'Python, OpenCV, YOLO, PyTorch', required: false })
  @IsOptional()
  @IsString()
  congNghe?: string;

  @ApiProperty({ example: 2, default: 2, description: 'Số lượng sinh viên tối đa (từ 1 đến 2)', required: false })
  @IsOptional()
  @IsInt({ message: 'Số lượng sinh viên phải là số nguyên' })
  @Min(1, { message: 'Số lượng sinh viên tối thiểu của mỗi nhóm là 1 sinh viên' })
  @Max(2, { message: 'Số lượng sinh viên tối đa của mỗi nhóm là 2 sinh viên' })
  capacity?: number;

  @ApiProperty({ example: 2, default: 2, description: 'Số lượng sinh viên tối đa (tiếng Việt) (từ 1 đến 2)', required: false })
  @IsOptional()
  @IsInt({ message: 'Số lượng sinh viên phải là số nguyên' })
  @Min(1, { message: 'Số lượng sinh viên tối thiểu của mỗi nhóm là 1 sinh viên' })
  @Max(2, { message: 'Số lượng sinh viên tối đa của mỗi nhóm là 2 sinh viên' })
  soLuongToiDa?: number;

  @ApiProperty({ example: 'uuid-department', required: false, description: 'ID Bộ môn (tuỳ chọn, tự động nhận từ profile)' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ example: 'uuid-semester', required: false, description: 'ID Học kỳ / Đợt KLTN' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;
}
