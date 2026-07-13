import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { TechEffect } from '../effect-types';

@Entity({ name: 'techs' })
export class Tech extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column({ unique: true })
  public key: string;

  @Column()
  public name: string;

  @Column({ type: 'text' })
  public description: string;

  @Column()
  public branch: string;

  @Column({ name: 'is_class_root', default: false })
  public isClassRoot: boolean;

  @Column({ default: 0 })
  public cost: number;

  @Column({ type: 'simple-array', nullable: true })
  public prerequisites: string[];

  /** Data-driven mechanical effect(s) of this tech — see `effect-types.ts`. */
  @Column({ type: 'json', nullable: true })
  public effects: TechEffect[] | null;
}
