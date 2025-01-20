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
}

export class AddTicketTierDto {
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

export class NearbyEventsDto {
  @IsString({ message: 'Invalid "latitude" query parameter' })
  @IsNotEmpty({ message: '"latitude" query parameter is required' })
  latitude: string
  
  @IsString({ message: 'Invalid "longitude" query parameter' })
  @IsNotEmpty({ message: '"longitude" query parameter is required' })
  longitude: string
}