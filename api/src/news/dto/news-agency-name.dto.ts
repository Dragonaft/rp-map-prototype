import { IsString, Length } from 'class-validator';

export class NewsAgencyNameDto {
  @IsString()
  @Length(2, 40)
  name: string;
}
