import { IsString } from 'class-validator';

export class DeclareWarDto {
  @IsString()
  targetUserId: string;
}
