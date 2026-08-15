import { IsString, Length } from 'class-validator';

export class CreateNewsArticleDto {
  @IsString()
  @Length(1, 150)
  title: string;

  /** Markdown body. */
  @IsString()
  @Length(1, 20000)
  content: string;
}
