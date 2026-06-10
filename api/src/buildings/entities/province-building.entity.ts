import {
  BaseEntity,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Column,
} from 'typeorm';
import { Province } from '../../provinces/entities/province.entity';
import { Building } from './building.entity';

@Entity({ name: 'province_building' })
export class ProvinceBuilding extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public province_id: string;

  @Column()
  public building_id: string;

  @ManyToOne(() => Province, (province) => province.provinceBuildings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'province_id' })
  public province: Province;

  @ManyToOne(() => Building, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'building_id' })
  public building: Building;
}
