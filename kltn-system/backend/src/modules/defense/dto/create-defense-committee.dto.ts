import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDefenseCommitteeDto {
  @IsNotEmpty({ message: 'semesterId không được để trống' })
  @IsUUID('4', { message: 'semesterId phải là UUID hợp lệ' })
  semesterId!: string;

  @IsArray({ message: 'groupIds phải là một mảng' })
  @IsUUID('4', { each: true, message: 'ID nhóm phải là UUID hợp lệ' })
  groupIds!: string[];

  @IsArray({ message: 'memberIds phải là một mảng' })
  @ArrayMinSize(3, { message: 'Hội đồng bảo vệ phải có tối thiểu 3 thành viên' })
  @IsUUID('4', { each: true, message: 'ID thành viên hội đồng phải là UUID hợp lệ' })
  memberIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Tên hội đồng tối đa 200 ký tự' })
  tenHoiDong?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

