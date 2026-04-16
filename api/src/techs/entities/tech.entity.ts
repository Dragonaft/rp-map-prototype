import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

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

  @Column({ type: 'simple-array', default: '' })
  public prerequisites: string[];
}
