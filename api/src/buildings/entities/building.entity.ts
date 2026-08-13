import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { BuildingTypes } from "../types/building.types";
import { Exclude, Expose } from "class-transformer";
import { Good } from "../../goods/entities/good.entity";

@Entity({ name: 'buildings' })
export class Building extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public type: BuildingTypes;

  @Column()
  public name: string;

  @Column()
  public description: string;

  @Column({ nullable: true })
  public income: number;

  @Column({ nullable: true })
  public upkeep: number;

  @Column({ nullable: true })
  public modifier: string;

  @Column({ nullable: true })
  public cost: number;

  @Column({ nullable: true })
  @Expose({ name: 'upgradeTo' })
  public upgrade_to: BuildingTypes | null;

  @Column({ type: 'simple-array', nullable: true })
  @Expose({ name: 'requirementTech' })
  public requirement_tech: string[];

  @Column({ nullable: true })
  @Expose({ name: 'requirementBuilding' })
  public requirement_building: BuildingTypes | null;

  @Column({ default: true })
  public buildable: boolean;

  @Column({ default: true })
  public destructible: boolean;

  @Column({ default: false })
  @Expose({ name: 'uniquePerProvince' })
  public unique_per_province: boolean;

  /** True if this building can only be built in a province with at least one neighboring water province (e.g. Port). */
  @Column({ default: false })
  @Expose({ name: 'requiresNeighborWater' })
  public requires_neighbor_water: boolean;

  /** True if this building acts as an army supply source (SupplyActionService's BFS origin). Seeded on FORT/CASTLE/CAPITAL. */
  @Column({ default: false })
  @Expose({ name: 'supplyBuilding' })
  public supply_building: boolean;

  @Column({ type: 'simple-array', nullable: true })
  @Expose({ name: 'allowedProvinceResources' })
  public allowed_province_resources: string[] | null;

  @Column({ nullable: true })
  @Expose({ name: 'requirementResource' })
  public requirement_resource: string | null;

  @Column({ nullable: true })
  @Expose({ name: 'requirementResourceAmount' })
  public requirement_resource_amount: number | null;

  @Column({ default: false })
  public visible: boolean;

  @Column({ default: false })
  @Expose({ name: 'canRecruit' })
  public can_recruit: boolean;

  @Column({ default: false })
  public isProduction: boolean;

  @Column({ name: 'production_good_id', nullable: true })
  @Exclude()
  public production_good_id: string | null;

  @ManyToOne(() => Good, { nullable: true })
  @JoinColumn({ name: 'production_good_id' })
  @Exclude()
  public productionGoodEntity?: Good | null;

  @Expose({ name: 'productionGood' })
  get productionGood(): string | null {
    return this.production_good_id;
  }

  @Column({ nullable: true })
  @Expose({ name: 'productionRequirementResource' })
  public production_requirement_resource: string | null;

  @Column({ nullable: true })
  @Expose({ name: 'productionAmount' })
  public production_amount: number | null;

  /** Per-turn amount of the province's resource (province.resource.key) credited to the owner's UserResource stockpile — MINE/FORESTRY. */
  @Column({ nullable: true })
  @Expose({ name: 'resourceProductionAmount' })
  public resource_production_amount: number | null;

  /**
   * Overrides which resource key resource_production_amount credits, instead of the
   * province's own resource — e.g. PORT sits on land (grain/wood/whatever) but produces
   * fish. Null (the common case) keeps the existing "credit the province's own resource"
   * behavior unchanged.
   */
  @Column({ nullable: true })
  @Expose({ name: 'resourceProductionKey' })
  public resource_production_key: string | null;

  /** Per-turn amount of production_requirement_resource consumed (via tryReserve) to produce production_amount of the good. Production skips the turn if unavailable. */
  @Column({ nullable: true })
  @Expose({ name: 'productionRequirementResourceAmount' })
  public production_requirement_resource_amount: number | null;

  @Column({ name: 'requirement_good_id', nullable: true })
  @Exclude()
  public requirement_good_id: string | null;

  @ManyToOne(() => Good, { nullable: true })
  @JoinColumn({ name: 'requirement_good_id' })
  @Exclude()
  public requirementGoodEntity?: Good | null;

  @Expose({ name: 'requirementGood' })
  get requirementGood(): string | null {
    return this.requirement_good_id;
  }

  @Column({ nullable: true })
  @Expose({ name: 'requirementGoodAmount' })
  public requirement_good_amount: number | null;

  /**
   * A second, independent one-time goods cost paid alongside requirement_good_id —
   * same tryReserve-at-build/refund-on-demolish mechanic. Introduced so Lumber (which
   * has no per-turn sink) can be a universal construction cost without displacing the
   * existing Weapons/Bricks slot already used by BARRACKS/SAWMILL/FORT.
   */
  @Column({ name: 'requirement_good_2_id', nullable: true })
  @Exclude()
  public requirement_good_2_id: string | null;

  @ManyToOne(() => Good, { nullable: true })
  @JoinColumn({ name: 'requirement_good_2_id' })
  @Exclude()
  public requirementGood2Entity?: Good | null;

  @Expose({ name: 'requirementGood2' })
  get requirementGood2(): string | null {
    return this.requirement_good_2_id;
  }

  @Column({ nullable: true })
  @Expose({ name: 'requirementGood2Amount' })
  public requirement_good_2_amount: number | null;

}
