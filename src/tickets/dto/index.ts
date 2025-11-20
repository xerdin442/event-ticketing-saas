import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDate,
} from "class-validator";

export class AddTicketTierDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsBoolean()
  @IsNotEmpty()
  discount: boolean;

  @IsNumber()
  @IsOptional()
  discountPrice?: number;

  @IsDate()
  @IsOptional()
  discountExpiration?: Date;

  @IsNumber()
  @IsOptional()
  numberOfDiscountTickets?: number;

  @IsString()
  @IsOptional()
  benefits?: string;

  @IsNumber()
  @IsNotEmpty()
  totalNumberOfTickets: number;
}

export class CreateDiscountDTO {
  @IsNumber()
  @IsNotEmpty()
  discountPrice: number;

  @IsDate()
  @IsNotEmpty()
  discountExpiration: Date;
  
  @IsNumber()
  @IsNotEmpty()
  numberOfDiscountTickets: number;
}

export class PurchaseTicketDTO {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  tier: string;
  
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsString()
  @IsOptional()
  whatsappPhoneId?: string;
}

export class ValidateTicketDTO {
  @IsString()
  @IsNotEmpty()
  accessKey: string;
}