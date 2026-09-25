import { IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTopicProposalDto {
  @ApiProperty({ description: 'Tên đề tài đề xuất', example: 'Xây dựng nền tảng IoT thông minh' })
  @IsString({ message: 'Tên đề tài phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên đề tài không được để trống' })
  @MinLength(5, { message: 'Tên đề tài tối thiểu 5 ký tự' })
  tenDeTai!: string;

  @ApiProperty({ description: 'Mô tả tóm tắt nội dung đề tài' })
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mô tả đề tài không được để trống' })
  @MinLength(10, { message: 'Mô tả đề tài tối thiểu 10 ký tự' })
  moTa!: string;

  @ApiProperty({ description: 'Yêu cầu đối với đề tài' })
  @IsString({ message: 'Yêu cầu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Yêu cầu đề tài không được để trống' })
  yeuCau!: string;

  @ApiProperty({ description: 'ID của Giảng viên hướng dẫn mong muốn (User ID hoặc LecturerProfile ID)' })
  @IsUUID(undefined, { message: 'Mã giảng viên hướng dẫn (gvhdId) phải là định dạng UUID' })
  @IsNotEmpty({ message: 'Vui lòng chọn Giảng viên hướng dẫn mong muốn' })
  gvhdId!: string;
}

