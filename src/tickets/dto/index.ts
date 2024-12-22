import { IsString, IsNotEmpty, IsNumber } from "class-validator";

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  tier: string;
  
  @IsNumber()
  @IsNotEmpty()
  price: number;
  
  @IsString()
  @IsNotEmpty()
  accessKey: string;
}