import { Expose } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class ProvincesUpdateBodyRequest {
  @IsString()
  @IsOptional()
  public readonly login: string;

  @IsString()
  @IsOptional()
  public readonly password: string;

  @IsString()
  @IsOptional()
  @Expose({ name: 'countryName' })
  public readonly country_name?: string;

  @IsNumber()
  @IsOptional()
  public readonly money?: number;

  @IsNumber()
  @IsOptional()
  public readonly troops?: number;
}
