import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WarStatus } from '../types/diplomacy.types';
import { WarParticipant } from './war-participant.entity';

@Entity({ name: 'wars' })
export class War extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public attacker_leader_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attacker_leader_id' })
  public attackerLeader: User;

  @Column()
  public defender_leader_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'defender_leader_id' })
  public defenderLeader: User;

  @Column({ default: WarStatus.ACTIVE })
  public status: WarStatus;

  @OneToMany(() => WarParticipant, (p) => p.war, { eager: true, cascade: true })
  public participants: WarParticipant[];

  @CreateDateColumn()
  public readonly createdAt: Date;
}
