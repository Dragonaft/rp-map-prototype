import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserTechProgress } from './entities/user-tech-progress.entity';

@Injectable()
export class UserTechProgressService {
  constructor(
    @InjectRepository(UserTechProgress)
    private readonly progressRepo: Repository<UserTechProgress>,
  ) {}

  async getForUser(userId: string): Promise<UserTechProgress[]> {
    return this.progressRepo.find({ where: { user_id: userId } });
  }

  /** Locates (or lazily creates) a user's progress row for a tech, locked for update within the given transaction. */
  private async lockRow(
    manager: EntityManager, userId: string, techKey: string,
  ): Promise<UserTechProgress> {
    let row = await manager.findOne(UserTechProgress, {
      where: { user_id: userId, tech_key: techKey },
      lock: { mode: 'pessimistic_write' },
    });
    if (!row) {
      row = await manager.save(UserTechProgress, manager.create(UserTechProgress, {
        user_id: userId, tech_key: techKey, progress: 0,
      }));
    }
    return row;
  }

  /** Adds `amount` (the per-turn research rate) to the tech's saved progress. Returns the new total. */
  async addProgress(
    manager: EntityManager, userId: string, techKey: string, amount: number,
  ): Promise<number> {
    const row = await this.lockRow(manager, userId, techKey);
    row.progress += amount;
    await manager.save(UserTechProgress, row);
    return row.progress;
  }

  /** Called when a tech completes (or its progress is otherwise no longer meaningful) — deletes the row. */
  async clearProgress(manager: EntityManager, userId: string, techKey: string): Promise<void> {
    await manager.delete(UserTechProgress, { user_id: userId, tech_key: techKey });
  }
}
