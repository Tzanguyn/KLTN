import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class DefenseFormatOverrideDto {
  @IsUUID()
  groupId!: string;

  @IsString()
  defenseFormat!: 'HOI_DONG' | 'POSTER';

  @IsOptional()
  @IsString()
  note?: string;
}

export class ClassifyDefenseFormatsDto {
  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  topPercentage?: number = 20;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  overrides?: DefenseFormatOverrideDto[];
}

