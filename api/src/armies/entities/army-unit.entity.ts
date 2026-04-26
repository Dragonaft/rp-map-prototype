import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Army } from './army.entity';
import { TroopType } from './troop-type.entity';

@Entity({ name: 'army_units' })
export class ArmyUnit extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public army_id: string;

  @ManyToOne(() => Army, (army) => army.units, { onDelete: 'CASCADE' })
  public army: Army;

  @Column()
  public troop_type_id: string;

  @ManyToOne(() => TroopType, (tt) => tt.units, { eager: true, onDelete: 'RESTRICT' })
  public troopType: TroopType;

  @Column({ default: 0 })
  public count: number;
}
