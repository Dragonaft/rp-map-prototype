import {
  BaseEntity,
  Column,
  Entity,
  ManyToMany,
  PrimaryColumn,
} from 'typeorm';
import { Province } from '../../provinces/entities/province.entity';

@Entity({ name: 'buildings' })
export class Building extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public type: string;

  @Column()
  public name: string;

  @Column({ nullable: true })
  public income: string;

  @Column({ nullable: true })
  public upkeep: string;

  @Column({ nullable: true })
  public modifier: string;

  @ManyToMany(() => Province, (province) => province.buildings)
  public provinces: Province[];
}
