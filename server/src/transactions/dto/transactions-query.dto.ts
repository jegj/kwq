import { IsOptional, IsString, MaxLength } from 'class-validator';

// Bounds only: unknown months/categories/parsers are still ignored by the
// controller (see URL design), but repeated params and huge values are 400s.
const MAX_PARAM_LENGTH = 64;

export class TransactionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PARAM_LENGTH)
  before?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_PARAM_LENGTH)
  after?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_PARAM_LENGTH)
  month?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_PARAM_LENGTH)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_PARAM_LENGTH)
  parser?: string;
}
