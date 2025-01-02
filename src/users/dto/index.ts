import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString
} from "class-validator";

export class updateProfileDto {
  @IsNumber()
  @IsOptional()
  age?: number;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsOptional()
  @IsString()
  twoFASecret?: string

  @IsOptional()
  @IsBoolean()
  twoFAEnabled?: boolean

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  bankName?: string;
}