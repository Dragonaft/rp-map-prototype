import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WarSide } from '../types/diplomacy.types';
import { War } from './war.entity';

@Entity({ name: 'war_participants' })
@Unique(['war_id', 'user_id'])
export class WarParticipant extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public war_id: string;

  @ManyToOne(() => War, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'war_id' })
  public war: War;

  @Column()
  public user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  public user: User;

  @Column({ type: 'varchar' })
  public side: WarSide;

  @Column({ default: false })
  public is_leader: boolean;
}
