import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProposeTimeDto {
  @IsDateString({}, { message: 'Thời gian đề xuất phải đúng định dạng ngày giờ hợp lệ' })
  proposedTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Ghi chú đề xuất không được vượt quá 500 ký tự' })
  note?: string;
}

