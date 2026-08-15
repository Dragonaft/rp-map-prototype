import { Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// Application-level cap on lore length — the `mediumtext` column can hold far more, but this
// keeps the field to "a few pages of RP prose" rather than unbounded. Mirrored client-side in
// web-map's ProfileModal.tsx for fast feedback (same duplication convention as FLAG_MAX_BYTES).
export const LORE_MAX_LENGTH = 20_000;

export class UsersUpdateBodyRequest {
  @IsString()
  @IsOptional()
  @Expose({ name: 'countryName' })
  public readonly country_name?: string;

  @IsString()
  @IsOptional()
  public readonly color?: string;

  @IsString()
  @IsOptional()
  @MaxLength(LORE_MAX_LENGTH)
  public readonly lore?: string;
}
