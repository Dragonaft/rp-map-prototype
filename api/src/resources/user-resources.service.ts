import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { UserResource } from './entities/user-resource.entity';
import { Resource } from './entities/resource.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class UserResourcesService {
  constructor(
    @InjectRepository(UserResource)
    private readonly userResourceRepo: Repository<UserResource>,
    @InjectRepository(Resource)
    private readonly resourceRepo: Repository<Resource>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getForUser(userId: string): Promise<UserResource[]> {
    return this.userResourceRepo.find({ where: { user_id: userId } });
  }

  /** Backfills a zero-quantity row for every existing user so the new resource shows up in everyone's ledger. */
  async createRowsForNewResource(resource: Resource): Promise<void> {
    const users = await this.userRepo.find({ select: ['id'] });
    if (!users.length) return;

    const rows = users.map((user) =>
      this.userResourceRepo.create({ user_id: user.id, resource_id: resource.id, quantity: 0 }),
    );
    await this.userResourceRepo.save(rows);
  }

  /** Backfills a zero-quantity row for every existing resource so a new user has a full ledger from the start. */
  async createRowsForNewUser(user: User): Promise<void> {
    const resources = await this.resourceRepo.find({ select: ['id'] });
    if (!resources.length) return;

    const rows = resources.map((resource) =>
      this.userResourceRepo.create({ user_id: user.id, resource_id: resource.id, quantity: 0 }),
    );
    await this.userResourceRepo.save(rows);
  }

  /** Locates (or lazily creates) a user's ledger row for a resource key, locked for update within the given transaction. */
  private async lockRow(
    manager: EntityManager, userId: string, resourceKey: string,
  ): Promise<UserResource | null> {
    const resource = await manager.findOne(Resource, { where: { key: resourceKey } });
    if (!resource) return null;

    let row = await manager.findOne(UserResource, {
      where: { user_id: userId, resource_id: resource.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!row) {
      row = await manager.save(UserResource, manager.create(UserResource, {
        user_id: userId, resource_id: resource.id, quantity: 0,
      }));
    }
    return row;
  }

  /**
   * Unconditional grant/release, clamped at 0. Used for MINE/FORESTRY production
   * capacity (+/-1) and for releasing a requirement_resource reservation on demolish.
   */
  async adjustQuantity(
    manager: EntityManager, userId: string, resourceKey: string, delta: number,
  ): Promise<void> {
    const row = await this.lockRow(manager, userId, resourceKey);
    if (!row) return;
    row.quantity = Math.max(0, row.quantity + delta);
    await manager.save(UserResource, row);
  }

  /** Atomic conditional decrement: reserves `amount` only if available, otherwise leaves the ledger untouched. */
  async tryReserve(
    manager: EntityManager, userId: string, resourceKey: string, amount: number,
  ): Promise<{ ok: boolean; available: number }> {
    const row = await this.lockRow(manager, userId, resourceKey);
    const available = row?.quantity ?? 0;
    if (available < amount) {
      return { ok: false, available };
    }

    row.quantity = available - amount;
    await manager.save(UserResource, row);
    return { ok: true, available };
  }

  /** Sum of quantity * resource.plain_income per user — replaces the old per-turn MINE building scan. */
  async sumIncomeForUsers(manager: EntityManager, userIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!userIds.length) return result;

    const rows = await manager.find(UserResource, { where: { user_id: In(userIds) } });
    for (const row of rows) {
      const income = row.quantity * (row.resource?.plain_income ?? 0);
      result.set(row.user_id, (result.get(row.user_id) ?? 0) + income);
    }
    return result;
  }

  async sumIncomeForUser(manager: EntityManager, userId: string): Promise<number> {
    const map = await this.sumIncomeForUsers(manager, [userId]);
    return map.get(userId) ?? 0;
  }

  /**
   * Bulk read-only quantities for a set of users, keyed by userId then resource
   * key — for gating checks (e.g. "does this user have any iron?") that don't
   * need a row lock since nothing is mutated.
   */
  async getQuantitiesForUsers(manager: EntityManager, userIds: string[]): Promise<Map<string, Map<string, number>>> {
    const result = new Map<string, Map<string, number>>();
    if (!userIds.length) return result;

    const rows = await manager.find(UserResource, { where: { user_id: In(userIds) } });
    for (const row of rows) {
      const byResource = result.get(row.user_id) ?? new Map<string, number>();
      if (row.resource?.key) byResource.set(row.resource.key, row.quantity);
      result.set(row.user_id, byResource);
    }
    return result;
  }

  /** Default (non-transactional) EntityManager, for call sites outside a per-action/per-tick transaction. */
  get defaultManager(): EntityManager {
    return this.userResourceRepo.manager;
  }
}
