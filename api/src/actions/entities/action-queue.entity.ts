import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ActionType {
  BUILD = 'BUILD',
  INVADE = 'INVADE',
  RECRUIT = 'RECRUIT',
  UPGRADE = 'UPGRADE',
  TRANSFER_TROOPS = 'TRANSFER_TROOPS',
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

@Entity({ name: 'action_queue' })
export class ActionQueue extends BaseEntity {
  @PrimaryGeneratedColumn()
  public readonly id: number;

  @ManyToOne(() => User, { eager: true })
  public user: User;

  @Column()
  public userId: string;

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

  @Column({ type: 'timestamp' })
  public scheduledFor: Date;

  @Column({ type: 'text', nullable: true })
  public failureReason?: string;

  @CreateDateColumn()
  public readonly createdAt: Date;

  @UpdateDateColumn()
  public readonly updatedAt: Date;
}
