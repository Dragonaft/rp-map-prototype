import { BaseEntity, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  ACTION_FAILED = 'action_failed',
  SYSTEM = 'system',
  ADMIN = 'admin',
}

export enum NotificationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

/** Durable, per-user notification — survives past the action queue's same-turn cleanup, unlike ActionQueue.failureReason. */
@Entity({ name: 'notifications' })
export class Notification extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Index()
  @Column()
  public user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  public user: User;

  @Column({ type: 'varchar' })
  public type: NotificationType;

  @Column({ type: 'varchar', default: NotificationSeverity.INFO })
  public severity: NotificationSeverity;

  @Column()
  public title: string;

  @Column({ type: 'text' })
  public message: string;

  @Column({ default: false })
  public is_read: boolean;

  @CreateDateColumn()
  public readonly createdAt: Date;
}
