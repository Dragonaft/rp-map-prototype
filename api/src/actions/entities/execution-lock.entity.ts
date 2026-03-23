import {
  BaseEntity,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'execution_locks' })
export class ExecutionLock extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  public lockKey: string;

  @Column({ type: 'timestamp' })
  public lockedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public lockedBy: string; // Server instance ID or hostname

  @UpdateDateColumn()
  public readonly updatedAt: Date;
}
