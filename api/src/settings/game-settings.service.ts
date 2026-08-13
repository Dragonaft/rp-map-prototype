import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSettings } from './entities/game-settings.entity';

const GLOBAL_ROW_ID = 'global';
const DEFAULT_PAUSE_MESSAGE = 'The game is currently paused. Please check back later.';
const CACHE_TTL_MS = 5_000;

/**
 * Reads/writes the single global `game_settings` row. Cached in-memory with a short TTL
 * because GamePauseInterceptor reads this on every authenticated request — an uncached
 * read would add a DB round-trip per request. Single-process only, same caveat
 * ActionExecutionStateService already documents for its own in-memory state: a write on
 * one instance isn't seen by another until its own cache entry expires.
 */
@Injectable()
export class GameSettingsService {
  private cached: GameSettings | null = null;
  private cachedAt = 0;

  constructor(
    @InjectRepository(GameSettings)
    private readonly repo: Repository<GameSettings>,
  ) {}

  async get(): Promise<GameSettings> {
    const now = Date.now();
    if (this.cached && now - this.cachedAt < CACHE_TTL_MS) {
      return this.cached;
    }

    let settings = await this.repo.findOne({ where: { id: GLOBAL_ROW_ID } });
    if (!settings) {
      // Defensive: keeps a DB that somehow skipped the migration seed from 500ing on
      // every request (same instinct as UserGoodsService.createRowsForNewUser).
      settings = this.repo.create({ id: GLOBAL_ROW_ID, is_paused: false, pause_message: null, turns_enabled: true, map_checksum: null });
      settings = await this.repo.save(settings);
    }

    this.cached = settings;
    this.cachedAt = now;
    return settings;
  }

  async update(patch: Partial<Pick<GameSettings, 'is_paused' | 'pause_message' | 'turns_enabled' | 'map_checksum'>>): Promise<GameSettings> {
    const current = await this.get();
    Object.assign(current, patch);
    const saved = await this.repo.save(current);
    this.cached = saved;
    this.cachedAt = Date.now();
    return saved;
  }

  async isPaused(): Promise<boolean> {
    return (await this.get()).is_paused;
  }

  async turnsEnabled(): Promise<boolean> {
    return (await this.get()).turns_enabled;
  }

  async pauseMessage(): Promise<string> {
    return (await this.get()).pause_message || DEFAULT_PAUSE_MESSAGE;
  }
}
