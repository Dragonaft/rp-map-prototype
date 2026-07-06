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

}
