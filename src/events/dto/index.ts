import { EventCategory } from "@prisma/client";
import { 
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDate,
  IsBoolean,
} from "class-validator";

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
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
  ageRestriction?: number
  
  @IsString()
  @IsNotEmpty()
  venue: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @IsNotEmpty()
  capacity: number;

  @IsNumber()
  @IsNotEmpty()
  revenue: number

  @IsString()
  @IsNotEmpty()
  organizerName: string[];

  @IsString()
  @IsNotEmpty()
  organizerEmail: string;

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

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
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
  ageRestriction?: number
  
  @IsString()
  @IsOptional()
  venue?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  organizerName?: string[];

  @IsString()
  @IsOptional()
  organizerEmail?: string;

  @IsNotEmpty()
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

export class addTicketTierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsBoolean()
  @IsNotEmpty()
  discount: boolean;

  @IsNumber()
  @IsOptional()
  discountPrice?: number;

  @IsDate()
  @IsOptional()
  discountExpiration?: Date;
  
  @IsNumber()
  @IsOptional()
  numberOfDiscountTickets?: number;

  @IsString()
  @IsOptional()
  benefits?: string;
  
  @IsNumber()
  @IsNotEmpty()
  totalNumberOfTickets: number;
}