import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional
} from "class-validator";

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