import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AssignmentType } from '@prisma/client';

export class AssignReviewerDto {
  @IsUUID()
  groupId!: string;

  @IsUUID()
  lecturerId!: string;

  @IsOptional()
  @IsEnum(AssignmentType)
  type?: AssignmentType;
}
