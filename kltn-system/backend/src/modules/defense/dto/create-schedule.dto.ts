import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateScheduleDto {
  @IsUUID()
  groupId!: string;

  @IsUUID()
  semesterId!: string;

  @IsOptional()
  @IsUUID()
  committeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  room?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
