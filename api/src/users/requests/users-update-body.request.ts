import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UsersUpdateBodyRequest {
  @IsString()
  @IsOptional()
  @Expose({ name: 'countryName' })
  public readonly country_name?: string;

  @IsString()
  @IsOptional()
  public readonly color?: string;
}
