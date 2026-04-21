import {
  BaseEntity,
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Expose, Exclude } from 'class-transformer';
import { Province } from '../../provinces/entities/province.entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public login: string;

  @Column()
  @Exclude({ toPlainOnly: true })
  public password: string;

  @Column()
  @Expose({ name: 'isNew' })
  public is_new: boolean;

  @Column({ nullable: true })
  @Expose({ name: 'countryName' })
  public country_name: string;

  @Column({ nullable: true })
  public color: string;

  @Column({ nullable: true })
  public money: number;

  @Column({ nullable: true })
  public troops: number;

  @Column({ default: 0 })
  public research_points: number;

  @Column({ type: 'simple-array', nullable: true })
  @Expose({ name: 'completedResearch' })
  public completed_research: string[];

  @Column({ type: 'varchar', nullable: true })
  public class: string | null;

  @OneToMany(() => Province, (province) => province.user)
  public readonly provinces?: Province[];
}
