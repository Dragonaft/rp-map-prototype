import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DiplomaticState } from '../types/diplomacy.types';

/**
 * One row per unordered player pair, created lazily on first non-neutral
 * event. user_a_id/user_b_id are stored canonically sorted (a < b) so a pair
 * never gets two rows. Absence of a row means NEUTRAL.
 */
@Entity({ name: 'diplomatic_relations' })
@Unique(['user_a_id', 'user_b_id'])
export class DiplomaticRelation extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public user_a_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_a_id' })
  public userA: User;

  @Column()
  public user_b_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_b_id' })
  public userB: User;

  @Column({ default: DiplomaticState.NEUTRAL })
  public state: DiplomaticState;

  /** Turns spent in PEACE so far; auto-decays to NEUTRAL at PEACE_DURATION_TURNS. */
  @Column({ default: 0 })
  public peace_turns: number;

  @Column({ default: false })
  public has_trade: boolean;

  /** Directional troops-pass grants; ALLIANCE implies both true. */
  @Column({ default: false })
  public pass_a_to_b: boolean;

  @Column({ default: false })
  public pass_b_to_a: boolean;
}
