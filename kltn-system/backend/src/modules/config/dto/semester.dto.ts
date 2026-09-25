import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { SemesterStatus } from '@prisma/client';

export class SemesterDto {
  @IsString() @MinLength(2) @MaxLength(30) code!: string;
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsString() @MaxLength(20) academicYear!: string;
  @IsUUID() departmentId!: string;
  @IsOptional() @IsEnum(SemesterStatus) status?: SemesterStatus;
  @IsOptional() @IsDateString() registrationFrom?: string;
  @IsOptional() @IsDateString() registrationTo?: string;
  @IsOptional() @IsDateString() submissionTo?: string;
  @IsOptional() @IsDateString() defenseFrom?: string;
  @IsOptional() @IsDateString() defenseTo?: string;
}
