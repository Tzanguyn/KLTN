import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignReviewersDto {
  @IsNotEmpty({ message: 'groupId không được để trống' })
  @IsUUID('4', { message: 'groupId phải là UUID hợp lệ' })
  groupId!: string;

  @IsArray({ message: 'reviewerIds phải là một mảng' })
  @ArrayMinSize(2, { message: 'Phải chọn đúng 2 giảng viên phản biện' })
  @ArrayMaxSize(2, { message: 'Phải chọn đúng 2 giảng viên phản biện' })
  @IsUUID('4', { each: true, message: 'ID giảng viên phản biện phải là UUID hợp lệ' })
  reviewerIds!: [string, string];
}

