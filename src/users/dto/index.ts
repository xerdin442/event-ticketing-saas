import { EventCategory } from "prisma/generated/enums";
import { IsArray, IsEnum, IsOptional } from "class-validator";

export class UpdateProfileDTO {
  @IsArray()
  @IsEnum(EventCategory, { each: true })
  @IsOptional()
  preferences?: EventCategory[];
}
