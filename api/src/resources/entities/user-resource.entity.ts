import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Resource } from './resource.entity';

@Entity({ name: 'user_resources' })
@Unique(['user_id', 'resource_id'])
export class UserResource extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  public user: User;

  @Column()
  public resource_id: string;

  @ManyToOne(() => Resource, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id' })
  public resource: Resource;

  @Column({ default: 0 })
  public quantity: number;
}
