import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserGood } from './entities/user-good.entity';
import { Good } from './entities/good.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class UserGoodsService {
  constructor(
    @InjectRepository(UserGood)
    private readonly userGoodRepo: Repository<UserGood>,
    @InjectRepository(Good)
    private readonly goodRepo: Repository<Good>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getForUser(userId: string): Promise<UserGood[]> {
    return this.userGoodRepo.find({ where: { user_id: userId } });
  }

  /** Backfills a zero-quantity row for every existing user so the new good shows up in everyone's storage. */
  async createRowsForNewGood(good: Good): Promise<void> {
    const users = await this.userRepo.find({ select: ['id'] });
    if (!users.length) return;

    const rows = users.map((user) =>
      this.userGoodRepo.create({ user_id: user.id, good_id: good.id, quantity: 0 }),
    );
    await this.userGoodRepo.save(rows);
  }

  /** Backfills a zero-quantity row for every existing good so a new user has a full storage from the start. */
  async createRowsForNewUser(user: User): Promise<void> {
    const goods = await this.goodRepo.find({ select: ['id'] });
    if (!goods.length) return;

    const rows = goods.map((good) =>
      this.userGoodRepo.create({ user_id: user.id, good_id: good.id, quantity: 0 }),
    );
    await this.userGoodRepo.save(rows);
  }

  /** Locates (or lazily creates) a user's ledger row for a good id, locked for update within the given transaction. */
  private async lockRow(manager: EntityManager, userId: string, goodId: string): Promise<UserGood> {
    let row = await manager.findOne(UserGood, {
      where: { user_id: userId, good_id: goodId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!row) {
      row = await manager.save(UserGood, manager.create(UserGood, {
        user_id: userId, good_id: goodId, quantity: 0,
      }));
    }
    return row;
  }

  /**
   * Unconditional grant/release, clamped at 0. Used to credit turn production
   * into a user's stockpile of a specific good (looked up by id, not key —
   * Good has no natural key like Resource does).
   */
  async adjustQuantity(
    manager: EntityManager, userId: string, goodId: string, delta: number,
  ): Promise<void> {
    const row = await this.lockRow(manager, userId, goodId);
    row.quantity = Math.max(0, row.quantity + delta);
    await manager.save(UserGood, row);
  }

  /** Atomic conditional decrement: reserves `amount` only if available, otherwise leaves the ledger untouched. */
  async tryReserve(
    manager: EntityManager, userId: string, goodId: string, amount: number,
  ): Promise<{ ok: boolean; available: number }> {
    const row = await this.lockRow(manager, userId, goodId);
    if (row.quantity < amount) {
      return { ok: false, available: row.quantity };
    }

    const available = row.quantity;
    row.quantity = available - amount;
    await manager.save(UserGood, row);
    return { ok: true, available };
  }
}
