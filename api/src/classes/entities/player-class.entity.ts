import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { Expose } from 'class-transformer';

/**
 * A player class (noble/holy/guild, plus any admin-created ones). `key` is the
 * back-compat string stored on `User.class` and compared against `Tech.branch` —
 * it must stay equal to the tech branch it gates, since that coupling is pure
 * string equality throughout the codebase (see TechsService, CLASS_RESTRICTED_TROOPS).
 */
@Entity({ name: 'classes' })
export class PlayerClass extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column({ unique: true })
  public key: string;

  @Column()
  public name: string;

  @Column({ name: 'is_visible', default: true })
  @Expose({ name: 'isVisible' })
  public is_visible: boolean;
}
