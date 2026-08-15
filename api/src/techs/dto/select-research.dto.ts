import { IsString } from 'class-validator';

export class SelectResearchDto {
  @IsString()
  tech_key: string;
}
