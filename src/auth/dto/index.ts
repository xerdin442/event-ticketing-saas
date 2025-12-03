import { 
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsStrongPassword
} from "class-validator";
import { EventCategory } from "prisma/generated/enums";

export class CreateUserDTO {
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1
  }, { message: 'Password must contain at least one uppercase and lowercase letter, one digit and one symbol' })
  password: string;

  @IsArray()
  @IsEnum(EventCategory, { each: true })
  preferences: EventCategory[];
}

export class LoginDTO {
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyOTPDTO {
  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsNotEmpty()
  resetId: string;
}

export class NewPasswordDTO {
  @IsString()
  @IsNotEmpty()
  resetId: string;

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1
  }, { message: 'Password must contain at least one uppercase and lowercase letter, one digit and one symbol' })
  newPassword: string;
}