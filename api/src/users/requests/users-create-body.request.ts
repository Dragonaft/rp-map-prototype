import { Expose } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
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
  @Expose({ name: 'countryName' })
  public readonly country_name?: string;

  @IsString()
  public readonly color: string;

  @IsNumber()
  public readonly troops: number;

  @IsNumber()
  public readonly money: number;
}
