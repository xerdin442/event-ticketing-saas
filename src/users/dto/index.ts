import { IsBoolean, IsEmail, IsOptional, IsString } from "class-validator";

export class updateProfileDto {
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
  profileImage?: string

  @IsOptional()
  @IsString()
  twoFASecret?: string

  @IsOptional()
  @IsBoolean()
  twoFAEnabled?: boolean
}