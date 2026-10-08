import { OperationType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class TransactionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  merchant!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  transactionDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @Matches(/^\d{4}$/)
  cardLastFour?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  operationNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  operationDescription?: string | null;

  @IsOptional()
  @IsEnum(OperationType)
  operationType?: OperationType | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}
