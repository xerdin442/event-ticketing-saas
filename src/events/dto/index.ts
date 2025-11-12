import { EventCategory } from "@prisma/client";
import { 
  IsEnum,
  IsNotEmpty,
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

  @IsEnum(EventCategory, { message: 'Invalid category value' })
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

export class NearbyEventsDto {
  @IsString()
  @IsNotEmpty()
  latitude: string
  
  @IsString()
  @IsNotEmpty()
  longitude: string
}