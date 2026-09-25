import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MidtermStatus } from '@prisma/client';

export class MidtermDto {
  @IsEnum(MidtermStatus)
  status!: MidtermStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
