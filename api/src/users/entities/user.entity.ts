import {
  BaseEntity,
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Province } from '../../provinces/entities/province.entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public login: string;

  @Column()
  public password: string;

  @Column({ nullable: true })
  public country_name: string;

  @Column({ nullable: true })
  public color: string;

  @Column({ nullable: true })
  public money: number;

  @Column({ nullable: true })
  public troops: number;

  @OneToMany(() => Province, (province) => province.user)
  public readonly provinces?: Province[];
}
