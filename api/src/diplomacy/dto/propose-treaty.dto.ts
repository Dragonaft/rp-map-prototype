import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PeaceScope, TreatyArticle, TreatyKind, TreatyVisibility } from '../types/diplomacy.types';

/**
 * Envelope for POST /diplomacy/treaties. Article shapes vary by treaty kind,
 * so their fine-grained validation happens in TreatyService.proposeTreaty —
 * this DTO only checks the envelope.
 */
export class ProposeTreatyDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  receiverId: string;

  @IsEnum(TreatyKind)
  kind: TreatyKind;

  @IsOptional()
  @IsEnum(PeaceScope)
  peaceScope?: PeaceScope;

  @IsOptional()
  @IsEnum(TreatyVisibility)
  visibility?: TreatyVisibility;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @IsArray()
  articles: TreatyArticle[];

  @IsOptional()
  @IsString()
  note?: string;
}
