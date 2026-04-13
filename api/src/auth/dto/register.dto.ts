import { IsString, Matches, MinLength } from 'class-validator';
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
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a valid hex color (e.g. #2f528a)' })
  color: string;
}
