import {
  BaseEntity,
  Column,
  Entity,
  ManyToMany,
  PrimaryColumn,
} from 'typeorm';
import { Province } from '../../provinces/entities/province.entity';
import { BuildingTypes } from "../types/building.types";

@Entity({ name: 'buildings' })
export class Building extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public type: BuildingTypes;

  @Column()
  public name: string;

  @Column({ nullable: true })
  public income: string;

  @Column({ nullable: true })
  public upkeep: string;

  @Column({ nullable: true })
  public modifier: string;

  @Column({ nullable: true })
  public cost: number;

  @ManyToMany(() => Province, (province) => province.buildings)
  public provinces: Province[];
}
