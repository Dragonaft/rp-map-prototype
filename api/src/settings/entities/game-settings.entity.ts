import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { Expose } from 'class-transformer';

/**
 * Global, server-wide game settings. This table is a singleton — the only row
 * ever written has id = 'global' — rather than a per-key row list, so every
 * setting stays a typed column (see GameSettingsService for the singleton
 * get-or-create logic).
 */
@Entity({ name: 'game_settings' })
export class GameSettings extends BaseEntity {
  @PrimaryColumn()
  public readonly id: string;

  @Column({ name: 'is_paused', default: false })
  @Expose({ name: 'isPaused' })
  public is_paused: boolean;

  @Column({ name: 'pause_message', nullable: true, type: 'varchar' })
  @Expose({ name: 'pauseMessage' })
  public pause_message: string | null;

  @Column({ name: 'turns_enabled', default: true })
  @Expose({ name: 'turnsEnabled' })
  public turns_enabled: boolean;
}
