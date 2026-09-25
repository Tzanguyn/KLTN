import { IsArray, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCommitteeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsUUID()
  departmentId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}
