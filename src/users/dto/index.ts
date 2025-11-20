import { EventCategory } from "@prisma/client";
import { IsArray, IsEnum, IsOptional } from "class-validator";

export class UpdateProfileDto {
  @IsArray()
  @IsEnum(EventCategory, { each: true })
  @IsOptional()
  preferences?: EventCategory[];
}
