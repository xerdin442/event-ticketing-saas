import { EventCategory } from "@prisma/client"
import { IsArray, IsEnum, IsNumber, IsOptional, IsString } from "class-validator"

export class EventFilterDTO {
  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  location?: string

  @IsString()
  @IsOptional()
  venue?: string

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsArray()
  @IsEnum(EventCategory, { each: true })
  @IsOptional()
  categories?: EventCategory[];

  @IsNumber()
  @IsOptional()
  page: number;
}
