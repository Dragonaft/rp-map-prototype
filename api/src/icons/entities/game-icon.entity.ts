import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { Exclude, Expose } from 'class-transformer';

/**
 * Admin-uploadable icon art for a game content slot (building type, landscape, or resource
 * key), replacing the previous system-dependent Unicode emoji. Modeled directly on the flag
 * columns in `User` (`api/src/users/entities/user.entity.ts`) — binary bytes excluded from
 * ordinary reads via `select: false`, a sniffed (not client-trusted) MIME type, and a sha256
 * hash doubling as an immutable cache-busting token. `kind` is a free string, not a DB enum
 * (matches this codebase's convention for kind-like fields, e.g. `Treaty.kind`), so new kinds
 * (goods, troop types, ...) need no schema change later.
 */
@Entity({ name: 'game_icons' })
export class GameIcon extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  /** 'building' | 'landscape' | 'resource' today — see class doc. */
  @Column()
  public kind: string;

  /** BuildingTypes value, Landscape value, or Resource.key — not validated against a fixed
   *  enum server-side, since buildings/resources are already admin-extensible. */
  @Column()
  public key: string;

  @Column({ type: 'mediumblob', select: false })
  @Exclude({ toPlainOnly: true })
  public icon_data: Buffer;

  @Column({ type: 'varchar' })
  @Exclude({ toPlainOnly: true })
  public icon_mime: string;

  /** sha256 of icon_data — cache-busting token used in the client-built icon URL (?v=hash) and
   *  as the binary route's ETag. */
  @Column({ type: 'varchar' })
  @Expose({ name: 'hash' })
  public icon_hash: string;
}
