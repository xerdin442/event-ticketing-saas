import { EventCategory } from "@prisma/client";
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString
} from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  age?: number

  @IsEmail()
  @IsOptional()
  email?: string

  @IsOptional()
  @IsString()
  accountNumber?: string

  @IsOptional()
  @IsString()
  accountName?: string

  @IsOptional()
  @IsString()
  bankName?: string

  @IsArray()
  preferences?: EventCategory[];  
}

export class CreateOrganizerProfileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsString()
  accountNumber: string;

  @IsNotEmpty()
  @IsString()
  accountName: string;

  @IsNotEmpty()
  @IsString()
  bankName: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsString()
  @IsOptional()
  twitter?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsString()
  @IsOptional()
  website?: string;
}

export class UpdateOrganizerProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  email?: string;
  
  @IsOptional()
  @IsString()
  accountNumber?: string

  @IsOptional()
  @IsString()
  accountName?: string

  @IsOptional()
  @IsString()
  bankName?: string  

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsString()
  @IsOptional()
  twitter?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsString()
  @IsOptional()
  website?: string;
}