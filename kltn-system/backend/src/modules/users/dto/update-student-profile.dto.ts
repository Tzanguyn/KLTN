import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateStudentProfileDto {
  @ApiPropertyOptional({
    description: 'Số điện thoại liên lạc Việt Nam (10 số, bắt đầu bằng số 0)',
    example: '0987654321',
  })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @Matches(/^0\d{9}$/, {
    message: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam gồm 10 số, bắt đầu bằng số 0 (ví dụ: 0987654321)',
  })
  soDienThoai?: string;

  @ApiPropertyOptional({
    description: 'Email cá nhân (Gmail, Outlook...)',
    example: 'sinhvien@gmail.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email cá nhân không đúng định dạng (ví dụ: name@gmail.com)' })
  @MaxLength(255, { message: 'Email cá nhân không được vượt quá 255 ký tự' })
  emailCaNhan?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ nơi ở / thường trú hiện tại',
    example: '123 Đường Nguyễn Trãi, Phường Bến Thành, Quận 1, TP.HCM',
  })
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Địa chỉ không được vượt quá 255 ký tự' })
  diaChi?: string;

  @ApiPropertyOptional({
    description: 'Thông tin liên lạc khác (Zalo, Telegram, ghi chú...)',
    example: 'Zalo: 0987654321',
  })
  @IsOptional()
  @IsString({ message: 'Thông tin liên lạc khác phải là chuỗi ký tự' })
  @MaxLength(500, { message: 'Thông tin liên lạc khác không được vượt quá 500 ký tự' })
  thongTinKhac?: string;

  @ApiPropertyOptional({ description: 'Alias for soDienThoai' })
  @IsOptional()
  @IsString()
  @Matches(/^0\d{9}$/, {
    message: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam gồm 10 số, bắt đầu bằng số 0',
  })
  phone?: string;

  @ApiPropertyOptional({ description: 'Alias for emailCaNhan' })
  @IsOptional()
  @IsEmail({}, { message: 'Email cá nhân không đúng định dạng' })
  personalEmail?: string;

  @ApiPropertyOptional({ description: 'Alias for diaChi' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Alias for thongTinKhac' })
  @IsOptional()
  @IsString()
  contactInfo?: string;
}

