import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PeaceScope, TreatyArticle, TreatyKind, TreatyStatus, TreatyVisibility } from '../types/diplomacy.types';

@Entity({ name: 'treaties' })
@Index(['receiver_id', 'status'])
@Index(['proposer_id'])
export class Treaty extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public name: string;

  @Column()
  public proposer_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proposer_id' })
  public proposer: User;

  @Column()
  public receiver_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiver_id' })
  public receiver: User;

  @Column({ type: 'varchar' })
  public kind: TreatyKind;

  /** Only meaningful for kind = peace. */
  @Column({ type: 'varchar', nullable: true })
  public peace_scope: PeaceScope | null;

  @Column({ default: TreatyVisibility.PRIVATE })
  public visibility: TreatyVisibility;

  /** Only meaningful for kind = trade: re-applies its transfer articles every turn. */
  @Column({ default: false })
  public recurring: boolean;

  @Column({ default: TreatyStatus.PENDING })
  public status: TreatyStatus;

  @Column({ type: 'json' })
  public articles: TreatyArticle[];

  @Column({ type: 'text', nullable: true })
  public note: string | null;

  /** Turns spent pending; auto-rejected at TREATY_EXPIRY_TURNS. */
  @Column({ default: 0 })
  public pending_turns: number;

  /**
   * True for the read-only copies of a leader-peace proposal sent to
   * non-leader allies (they can view but not accept/reject).
   */
  @Column({ default: false })
  public view_only: boolean;

  @CreateDateColumn()
  public readonly createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  public resolved_at: Date | null;
}
