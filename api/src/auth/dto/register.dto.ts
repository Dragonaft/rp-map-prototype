import { IsString, MinLength } from 'class-validator';
import { Expose } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  login: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @Expose({ name: 'countryName' })
  country_name: string;

  @IsString()
  color: string;
}
