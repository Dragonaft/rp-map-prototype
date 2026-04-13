import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface ExecutedAction {
  id: string;
  userId: string;
  actionType: string;
  actionData: any;
  status: string;
  order: number;
  executedAt: Date;
}

export interface ActionLogData {
  executionId: string;
  executedActions: ExecutedAction[];
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  executionStartTime: Date;
  executionEndTime: Date;
}

@Entity({ name: 'actions_log' })
export class ActionsLog extends BaseEntity {
  @PrimaryGeneratedColumn()
  public readonly id: number;

  @Column({ type: 'json' })
  public data: ActionLogData;

  @Column({ type: 'varchar', length: 10 })
  public timetable: string; // e.g., "12:00", "18:00"

  @CreateDateColumn()
  public readonly createdAt: Date;
}
