import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ActionType {
  BUILD = 'BUILD',
  UPGRADE = 'UPGRADE',
  RESEARCH = 'RESEARCH',
  REMOVE = 'REMOVE',
  DISBAND = 'DISBAND',
  ARMY_CREATE = 'ARMY_CREATE',
  ARMY_MOVE = 'ARMY_MOVE',
  ARMY_RECRUIT = 'ARMY_RECRUIT',
  ARMY_MERGE = 'ARMY_MERGE',
  ARMY_TRANSFER = 'ARMY_TRANSFER',
  ARMY_DISBAND = 'ARMY_DISBAND',
  ARMY_EDIT = 'ARMY_EDIT',
  COLONIZE = 'COLONIZE',
}

export enum ActionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRACTED = 'RETRACTED',
}

export interface ActionData {
  provinceId?: number;
  buildingType?: string;
  buildingId?: number;
  targetProvinceId?: number;
  troopCount?: number;
  upgradeLevel?: number;
  [key: string]: any; // Flexible for future action types
}

// Indexes below exist to keep the scheduler's/retract's queue-wide queries as narrow index range
// scans instead of full-table scans: under MySQL's default REPEATABLE READ, an unindexed
// UPDATE/DELETE range predicate forces InnoDB to next-key-lock every row it examines, which was
// deadlocking against concurrent `POST /actions` inserts (see cleanupExecutedActions' `status IN
// (...)` delete, every turn tick, and retractAction's `order > :x` bulk update).
@Entity({ name: 'action_queue' })
@Index('IDX_action_queue_status_order', ['status', 'order'])
@Index('IDX_action_queue_userId_status', ['userId', 'status'])
export class ActionQueue extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @ManyToOne(() => User, { eager: true })
  public user: User;

  @Column()
  public userId: string;

  @Index('IDX_action_queue_order')
  @Column()
  public order: number;

  @Column({
    type: 'enum',
    enum: ActionType,
  })
  public actionType: ActionType;

  @Column({ type: 'json' })
  public actionData: ActionData;

  @Column({
    type: 'enum',
    enum: ActionStatus,
    default: ActionStatus.PENDING,
  })
  public status: ActionStatus;

  @Column({ type: 'text', nullable: true })
  public failureReason?: string;

  @CreateDateColumn()
  public readonly createdAt: Date;

  @UpdateDateColumn()
  public readonly updatedAt: Date;
}
