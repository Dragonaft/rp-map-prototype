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
import { Province } from '../../provinces/entities/province.entity';
import { ArmyUnit } from './army-unit.entity';

@Entity({ name: 'armies' })
export class Army extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column({ nullable: true })
  public name: string | null;

  @Column()
  public user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  public user: User;

  @Column()
  public province_id: string;

  @ManyToOne(() => Province, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'province_id' })
  public province: Province;

  @Column({ default: 100 })
  public flat_upkeep: number;

  @OneToMany(() => ArmyUnit, (unit) => unit.army, { eager: true, cascade: true })
  public units: ArmyUnit[];

  @CreateDateColumn()
  public readonly createdAt: Date;
}
