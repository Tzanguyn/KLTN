import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  topicId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}
