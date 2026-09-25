import { IsBoolean, IsNumber, IsOptional, IsString, Max } from 'class-validator';

export class ReviewEvidenceDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsNumber()
  @Max(10)
  points?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
