import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { Expose } from 'class-transformer';
import { ResourceTypes } from '../types/resource.types';

@Entity({ name: 'resources' })
export class Resource extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column({ unique: true })
  public key: string;

  @Column()
  public name: string;

  @Column({ default: ResourceTypes.PLAIN })
  public type: ResourceTypes;

  @Column({ name: 'plain_income', default: 0 })
  @Expose({ name: 'plainIncome' })
  public plain_income: number;
}
