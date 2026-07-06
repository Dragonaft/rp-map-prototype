import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Good } from './good.entity';

@Entity({ name: 'user_goods' })
@Unique(['user_id', 'good_id'])
export class UserGood extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  public user: User;

  @Column()
  public good_id: string;

  @ManyToOne(() => Good, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'good_id' })
  public good: Good;

  @Column({ default: 0 })
  public quantity: number;
}
