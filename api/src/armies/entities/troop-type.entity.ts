import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { ArmyUnit } from './army-unit.entity';
import { Good } from '../../goods/entities/good.entity';

export enum TroopCategory {
  INFANTRY = 'INFANTRY',
  RANGED = 'RANGED',
  CAVALRY = 'CAVALRY',
  SPECIAL = 'SPECIAL',
  PEASANT = 'PEASANT',
}

@Entity({ name: 'troop_types' })
export class TroopType extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column({ unique: true })
  public key: string;

  @Column()
  public name: string;

  @Column({ type: 'text', nullable: true })
  public description: string;

  @Column({ type: 'enum', enum: TroopCategory })
  public category: TroopCategory;

  @Column({ default: 0 })
  public cost_per_100: number;

  @Column({ type: 'float', default: 1.0 })
  public attack: number;

  @Column({ type: 'float', default: 1.0 })
  public defense: number;

  /** Power multiplier applied to this troop type's attack/defense while fighting on a water province (default 1.0 = no penalty). */
  @Column({ type: 'float', default: 1.0 })
  public water_combat_modifier: number;

  @Column({ default: 100 })
  public upkeep_per_100: number;

  @Column({ nullable: true })
  public tech_requirement: string | null;

  @Column({ nullable: true })
  public building_requirement: string | null;

  @Column({ nullable: true })
  public required_goods: string | null;

  @ManyToOne(() => Good, { nullable: true })
  @JoinColumn({ name: 'required_goods' })
  public requiredGoodsEntity?: Good | null;

  @Column({ nullable: true })
  public goods_amount: number | null;

  @OneToMany(() => ArmyUnit, (unit) => unit.troopType)
  public units: ArmyUnit[];
}
