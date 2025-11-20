import { EventCategory } from "@prisma/client"
import { IsArray, IsDate, IsEnum, IsNumber, IsOptional, IsString } from "class-validator"

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
  startDate?: Date;

  @IsDate()
  @IsOptional()
  endDate?: Date;

  @IsArray()
  @IsEnum(EventCategory, { each: true })
  @IsOptional()
  categories?: EventCategory[];

  @IsNumber()
  @IsOptional()
  page: number;
}
