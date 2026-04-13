import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Exclude, Expose } from 'class-transformer';
import { User } from '../../users/entities/user.entity';
import { Building } from '../../buildings/entities/building.entity';

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

  @Column()
  @Exclude()
  public resource_type: string;

  @Expose({ name: 'resourceType' })
  get resourceType(): string {
    return this.resource_type;
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

  @Column({ nullable: true })
  @Exclude()
  public local_troops: number;

  @Expose({ name: 'localTroops' })
  get localTroops(): number {
    return this.local_troops;
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

  @ManyToMany(() => Building, (building) => building.provinces)
  @JoinTable({
    name: 'provinces_buildings',
    joinColumn: { name: 'province_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'building_id', referencedColumnName: 'id' },
  })
  public buildings: Building[];
}
