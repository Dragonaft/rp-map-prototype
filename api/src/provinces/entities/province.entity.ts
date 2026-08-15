import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Exclude, Expose } from 'class-transformer';
import { User } from '../../users/entities/user.entity';
import { Building } from '../../buildings/entities/building.entity';
import { ProvinceBuilding } from '../../buildings/entities/province-building.entity';
import { Resource } from '../../resources/entities/resource.entity';

@Entity({ name: 'provinces' })
export class Province extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public type: string;

  @Column()
  public landscape: string;

  @Column('text')
  public polygon: string;

  @Column({ nullable: true })
  @Exclude()
  public resource_id: string | null;

  @ManyToOne(() => Resource, { eager: true })
  @JoinColumn({ name: 'resource_id' })
  @Exclude()
  public resource: Resource | null;

  /** Kept as `resourceType` for API/frontend compatibility — returns the resource's key. */
  @Expose({ name: 'resourceType' })
  get resourceType(): string | null {
    return this.resource?.key ?? null;
  }

  @Column()
  @Exclude()
  public region_id: string;

  @Expose({ name: 'regionId' })
  get regionId(): string {
    return this.region_id;
  }

  @Column({ nullable: true })
  @Exclude()
  public user_id: string;

  @Expose({ name: 'userId' })
  get userId(): string {
    return this.user_id;
  }

  /** Military controller when the province is occupied (not the legal owner). Null = not occupied. */
  @Column({ nullable: true })
  @Exclude()
  public occupier_id: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'occupier_id' })
  @Exclude()
  public occupier?: User | null;

  @Expose({ name: 'occupierId' })
  get occupierId(): string | null {
    return this.occupier_id;
  }

  @Column({ default: 0 })
  @Exclude()
  public occupation_turns: number;

  @Expose({ name: 'occupationTurns' })
  get occupationTurns(): number {
    return this.occupation_turns;
  }

  @Column('simple-json', { nullable: true })
  @Exclude()
  public neighbor_ids: string[] | null;

  @Expose({ name: 'neighbors' })
  get neighbors(): string[] | null {
    return this.neighbor_ids;
  }

  /** Set at query-time: true when a non-owning user has troops stationed here. Not persisted. */
  @Expose()
  public enemyHere?: boolean;

  @ManyToOne(() => User, (user) => user.provinces)
  @JoinColumn({ name: 'user_id' })
  public user?: User;

  @OneToMany(() => ProvinceBuilding, (pb) => pb.province, { cascade: true })
  public provinceBuildings: ProvinceBuilding[];

  /** Computed getter — maps provinceBuildings to Building[] for backward compatibility. */
  get buildings(): Building[] {
    return this.provinceBuildings?.map((pb) => pb.building).filter(Boolean) ?? [];
  }
}
