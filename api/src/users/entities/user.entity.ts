import {
  BaseEntity,
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Expose, Exclude } from 'class-transformer';
import { Province } from '../../provinces/entities/province.entity';
import { UserRoles } from "../types/users.types";

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public login: string;

  @Column()
  @Exclude({ toPlainOnly: true })
  public password: string;

  @Column()
  @Expose({ name: 'isNew' })
  public is_new: boolean;

  @Column({ nullable: true })
  @Expose({ name: 'countryName' })
  public country_name: string;

  @Column({ nullable: true })
  public color: string;

  @Column({ nullable: true })
  public money: number;

  @Column({ nullable: true })
  public piety: number;

  @Column({ nullable: true })
  public troops: number;

  /** Research speed (points generated per turn) — not a bankable stockpile; recomputed and overwritten every turn. */
  @Column({ default: 0 })
  @Expose({ name: 'researchPoints' })
  public research_points: number;

  @Column({ type: 'simple-array', nullable: true })
  @Expose({ name: 'completedResearch' })
  public completed_research: string[];

  /** Tech key currently accruing progress each turn (single active slot). Null = idle. */
  @Column({ type: 'varchar', nullable: true })
  @Expose({ name: 'activeResearch' })
  public active_research_key: string | null;

  /** Class key (e.g. 'noble'/'holy'/'guild', or any admin-created class) — a free string,
   *  not an FK, so it stays in lockstep with Tech.branch by convention (see ClassesService). */
  @Column({ type: 'varchar', nullable: true })
  public class: string | null;

  @Column({ type: 'varchar', nullable: true })
  public role: UserRoles | null;

  @Column({ default: false })
  @Expose({ name: 'isNpc' })
  public is_npc: boolean;

  /** Consecutive turns money has ended negative; resets to 0 the moment money is >= 0. Triggers bankruptcy above BANKRUPTCY_TRIGGER_TURNS. */
  @Column({ default: 0 })
  public negative_money_turns: number;

  /** Turns remaining on the post-bankruptcy penalty (-50% combat power, no goods/resource production); 0 = not debuffed. */
  @Column({ default: 0 })
  public bankruptcy_debuff_turns: number;

  /** Raw flag image bytes (PNG/JPEG/WebP, size-capped, magic-byte validated). `select: false`
   *  so ordinary reads/saves (findOneEntity, update) never haul the blob through memory —
   *  GET /users/:id/flag re-selects it explicitly. Never serialized to JSON. */
  @Column({ type: 'mediumblob', nullable: true, select: false })
  @Exclude({ toPlainOnly: true })
  public flag_data: Buffer | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude({ toPlainOnly: true })
  public flag_mime: string | null;

  /** sha256 of flag_data — the immutable cache-busting token used in flagUrl (?v=hash). */
  @Column({ type: 'varchar', nullable: true })
  @Exclude({ toPlainOnly: true })
  public flag_hash: string | null;

  /** Freeform markdown RP background text, player-edited via the profile modal. Readable by
   *  other players via GET /users/:id/lore (not shipped in the bulk GET /users list). Null =
   *  never written. No @Exclude — rides the owner's GET /users/:id response for free. */
  @Column({ type: 'mediumtext', nullable: true })
  public lore: string | null;

  @OneToMany(() => Province, (province) => province.user)
  public readonly provinces?: Province[];
}
