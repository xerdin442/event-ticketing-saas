import { EventCategory } from "@prisma/client";
import { Type } from "class-transformer";
import { 
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString
} from "class-validator";

export class CreateEventDTO {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(EventCategory, { message: 'Invalid category value' })
  @IsNotEmpty()
  category: EventCategory;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  date: Date;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  startTime: Date;

  @Type(() => Date)
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

export class UpdateEventDTO {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(EventCategory, { message: 'Invalid category value' })
  @IsOptional()
  category?: EventCategory;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  date?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startTime?: Date; 

  @Type(() => Date)
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

export class VerifyTicketRefundDTO {
  @IsNotEmpty()
  @IsString()
  requestId: string;

  @IsNotEmpty()
  @IsString()
  otp: string;
}

export class ProcessTicketRefundDTO {
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