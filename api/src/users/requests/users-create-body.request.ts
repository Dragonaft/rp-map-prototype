import { Expose } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UsersCreateBodyRequest {
  @IsString()
  @IsNotEmpty()
  @Length(1, 190)
  public readonly login: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 190)
  public readonly password: string;

  @IsString()
  @Length(1, 190)
  @IsOptional()
  @Expose({ name: 'countryName' })
  public readonly country_name?: string;
}
