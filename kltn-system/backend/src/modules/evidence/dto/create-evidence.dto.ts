import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEvidenceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
