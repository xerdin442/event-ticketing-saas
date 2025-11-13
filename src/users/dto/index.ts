import { EventCategory } from "@prisma/client";
import { IsArray } from "class-validator";

export class UpdateProfileDto {
  @IsArray()
  preferences?: EventCategory[];  
}
