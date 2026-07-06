import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { GoodTypes } from '../types/good.types';

@Entity({ name: 'goods' })
export class Good extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public name: string;

  @Column({ default: GoodTypes.CIVILIAN })
  public type: GoodTypes;

  @Column({ name: 'price_per_one' })
  public price_per_one: number;
}
