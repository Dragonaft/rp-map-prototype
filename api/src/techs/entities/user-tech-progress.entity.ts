import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** Per-(user, tech) accumulated research progress, compared against Tech.cost to detect completion. */
@Entity({ name: 'user_tech_progress' })
@Unique(['user_id', 'tech_key'])
export class UserTechProgress extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  public user: User;

  @Column()
  public tech_key: string;

  @Column({ type: 'float', default: 0 })
  public progress: number;
}
