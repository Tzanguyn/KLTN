import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AddMemberDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsBoolean()
  isLeader?: boolean;
}
