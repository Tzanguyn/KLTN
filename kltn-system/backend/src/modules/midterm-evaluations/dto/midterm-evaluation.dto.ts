import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class MidtermEvaluationDto {
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsUUID()
  registrationId?: string;

  @IsIn(['CHO_LAM_TIEP', 'DUNG_DE_TAI', 'CONTINUE', 'STOPPED'], {
    message: 'ketQua phải là CHO_LAM_TIEP hoặc DUNG_DE_TAI',
  })
  ketQua!: 'CHO_LAM_TIEP' | 'DUNG_DE_TAI' | 'CONTINUE' | 'STOPPED';

  @IsOptional()
  @IsString()
  lyDo?: string;
}

