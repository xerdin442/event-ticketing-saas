import { EventCategory } from "@prisma/client";
import { 
  IsNotEmpty,
  IsOptional,
  IsString,
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

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  startTime: string; 

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsString()
  @IsOptional()
  ageRestriction?: string
  
  @IsString()
  @IsNotEmpty()
  venue: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  capacity: string;

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

  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  startTime?: string; 

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  ageRestriction?: string
  
  @IsString()
  @IsOptional()
  venue?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  capacity?: string;

  @IsString()
  @IsOptional()
  organizerName?: string[];

  @IsString()
  @IsOptional()
  organizerEmail?: string;

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

export class addTicketTierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  price: string;

  @IsBoolean()
  @IsNotEmpty()
  discount: boolean;

  @IsString()
  @IsOptional()
  discountPrice?: string;

  @IsString()
  @IsOptional()
  discountExpiration?: string;
  
  @IsString()
  @IsOptional()
  numberOfDiscountTickets?: string;

  @IsString()
  @IsOptional()
  benefits?: string;
  
  @IsString()
  @IsNotEmpty()
  totalNumberOfTickets: string;
}