import { IsInt, IsPositive, IsString } from 'class-validator';

export class SendMoneyDto {
  @IsString()
  targetUserId: string;

  @IsInt()
  @IsPositive()
  amount: number;
}
