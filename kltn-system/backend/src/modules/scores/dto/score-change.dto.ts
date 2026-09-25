import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ScoreChangeDto {
  @IsUUID()
  groupId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
