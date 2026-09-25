import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SendConversationMessageDto {
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi văn bản' })
  @MinLength(1, { message: 'Nội dung tin nhắn không được để trống' })
  @MaxLength(5000, { message: 'Nội dung tin nhắn không được vượt quá 5000 ký tự' })
  content!: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách tệp đính kèm phải là mảng' })
  attachments?: any[];
}

export class QueryConversationMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

