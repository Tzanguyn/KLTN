import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
export class ScoreDto { @IsUUID() groupId!: string; @IsUUID() criterionId!: string; @IsNumber() @Min(0) @Max(10) value!: number; @IsOptional() @IsString() note?: string; }
