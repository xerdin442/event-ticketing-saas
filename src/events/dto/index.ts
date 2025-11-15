import { EventCategory } from "@prisma/client";
import { 
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString
} from "class-validator";

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(EventCategory, { message: 'Invalid category value' })
  @IsNotEmpty()
  category: EventCategory;

  @IsDate()
  @IsNotEmpty()
  date: Date;

  @IsDate()
  @IsNotEmpty()
  startTime: Date;

  @IsDate()
  @IsNotEmpty()
  endTime: Date;

  @IsNumber()
  @IsOptional()
  ageRestriction?: number;
  
  @IsString()
  @IsNotEmpty()
  venue: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @IsNotEmpty()
  capacity: number;
}

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(EventCategory, { message: 'Invalid category value' })
  @IsOptional()
  category?: EventCategory;

  @IsDate()
  @IsOptional()
  date?: Date;

  @IsDate()
  @IsOptional()
  startTime?: Date; 

  @IsDate()
  @IsOptional()
  endTime?: Date;

  @IsNumber()
  @IsOptional()
  ageRestriction?: number;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;
}

export class VerifyTicketRefundDto {
  @IsNotEmpty()
  @IsString()
  requestId: string;

  @IsNotEmpty()
  @IsString()
  otp: string;
}

export class ProcessTicketRefundDto {
  @IsNotEmpty()
  @IsString()
  requestId: string;

  @IsNotEmpty()
  @IsString()
  accountNumber: string;

  @IsNotEmpty()
  @IsString()
  accountName: string;

  @IsNotEmpty()
  @IsString()
  bankName: string;
}