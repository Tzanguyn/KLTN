import { IsIn, IsOptional, IsString } from 'class-validator';
export class RegistrationDecisionDto { @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED'; @IsOptional() @IsString() note?: string; }
