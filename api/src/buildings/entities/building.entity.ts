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
  public income: number;

  @Column({ nullable: true })
  public upkeep: number;

  @Column({ nullable: true })
  public modifier: string;

  @Column({ nullable: true })
  public cost: number;

  @Column({ type: 'simple-array', nullable: true })
  public requirement_tech: string[];

  @Column({ nullable: true })
  public requirement_building: BuildingTypes | null;

  @ManyToMany(() => Province, (province) => province.buildings)
  public provinces: Province[];
}
