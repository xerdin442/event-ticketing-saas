import { IsString, IsNotEmpty, IsNumber } from "class-validator";

export class PurchaseTicketDto {
  @IsString()
  @IsNotEmpty()
  tier: string;
  
  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

export class ValidateTicketDto {
  @IsString()
  @IsNotEmpty()
  accessKey: string;
}