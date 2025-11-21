import { EventCategory } from "@prisma/client"
import { Transform } from "class-transformer"
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

  @Transform(({ value }) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsEnum(EventCategory, { each: true })
  @IsOptional()
  categories?: EventCategory[];

  @IsNumber()
  @IsOptional()
  page: number;
}
