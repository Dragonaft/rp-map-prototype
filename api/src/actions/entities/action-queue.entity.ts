import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ActionType {
  BUILD = 'BUILD',
  INVADE = 'INVADE',
  DEPLOY = 'DEPLOY',
  UPGRADE = 'UPGRADE',
  TRANSFER_TROOPS = 'TRANSFER_TROOPS',
  RESEARCH = 'RESEARCH',
  REMOVE = 'REMOVE',
  DISBAND = 'DISBAND',
  ARMY_CREATE = 'ARMY_CREATE',
  ARMY_MOVE = 'ARMY_MOVE',
  ARMY_RECRUIT = 'ARMY_RECRUIT',
  ARMY_MERGE = 'ARMY_MERGE',
  ARMY_DISBAND = 'ARMY_DISBAND',
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
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @ManyToOne(() => User, { eager: true })
  public user: User;

  @Column()
  public userId: string;

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
