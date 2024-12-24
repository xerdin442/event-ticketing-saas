import { EventCategory, TicketTier } from "@prisma/client";
import { 
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDate,
  IsArray
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
  numberOfShares: number;

  @IsNumber()
  @IsNotEmpty()
  revenue: number

  @IsString()
  @IsNotEmpty()
  poster: string;

  @IsString()
  @IsNotEmpty()
  media: string[];

  @IsArray()
  @IsNotEmpty()
  tickets: TicketTier[]

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
  category?: string;

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
  poster?: string;

  @IsString()
  @IsOptional()
  media?: string[];

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