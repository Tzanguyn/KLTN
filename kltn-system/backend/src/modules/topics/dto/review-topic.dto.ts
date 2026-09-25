import { IsBoolean, IsOptional, IsString } from 'class-validator';
export class ReviewTopicDto { @IsBoolean() approved!: boolean; @IsOptional() @IsString() note?: string; }
