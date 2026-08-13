import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Province } from '../provinces/entities/province.entity';
import { ProvinceBuilding } from '../buildings/entities/province-building.entity';
import { Army } from '../armies/entities/army.entity';
import { ArmyUnit } from '../armies/entities/army-unit.entity';
import { UserGameState } from './user-state-loader.service';
import { UserGoodsService } from '../goods/user-goods.service';
import { Notification, NotificationSeverity, NotificationType } from '../notifications/entities/notification.entity';
import {
  bfsDistances,
  computeArmyBaseFoodNeed,
  scaleFoodNeed,
  supplyMultiplierForDistance,
  SUPPLY_ATTRITION_RATE,
  SUPPLY_BFS_MAX_DEPTH,
} from './supply-utils';
import { TechEffectsService } from '../techs/tech-effects.service';

interface ArmySupplyPlan {
  army: Army;
  distance: number | null;
  multiplier: number;
  need: Map<string, number>; // good id -> amount, already distance-scaled
}

/**
 * Runs once per scheduled queue tick, right after UpkeepActionService, so armies pay food based
 * on where they're standing at the *start* of the turn — same convention as money/piety upkeep.
 *
 * Two responsibilities:
 *  1. Compute every army's distance to the nearest reachable supply_building (multi-source BFS,
 *     pure geography — not gated by territory control in between) and persist it to
 *     Army.supply_distance for the frontend/projection to read without re-running the BFS.
 *  2. Charge food (scaled by that distance) from UserGood, feeding armies in ascending
 *     multiplier order when a user can't cover everyone; unfed armies take attrition.
 */
@Injectable()
export class SupplyActionService {
  private readonly logger = new Logger(SupplyActionService.name);

  constructor(
    private readonly userGoodsService: UserGoodsService,
    private readonly techEffects: TechEffectsService,
  ) {}

  async execute(state: UserGameState, manager: EntityManager): Promise<void> {
    const { users } = state;
    if (users.length === 0) return;

    // Full province graph (every province, any owner) — supply range is pure geography.
    const provinces = await manager.find(Province, {
      select: ['id', 'user_id', 'occupier_id', 'neighbor_ids'],
    });
    const adjacency = new Map<string, string[]>();
    for (const p of provinces) adjacency.set(p.id, p.neighbor_ids ?? []);

    // Provinces holding a supply_building, keyed by whoever currently controls them — same
    // predicate as recruitment eligibility: the occupier controls an occupied province, the
    // legal owner controls an unoccupied one. An occupied fort therefore supplies its occupier,
    // not its legal owner, and the legal owner loses that source until it's retaken.
    const provinceBuildings = await manager.find(ProvinceBuilding); // `building` relation is eager
    const controllerByProvinceId = new Map(provinces.map((p) => [p.id, p.occupier_id ?? p.user_id]));
    const sourcesByUser = new Map<string, string[]>();
    for (const pb of provinceBuildings) {
      if (!pb.building?.supply_building) continue;
      const controllerId = controllerByProvinceId.get(pb.province_id);
      if (!controllerId) continue;
      const list = sourcesByUser.get(controllerId) ?? [];
      list.push(pb.province_id);
      sourcesByUser.set(controllerId, list);
    }

    const userIds = users.map((u) => u.id);
    const allArmies = await manager.find(Army, {
      where: { user_id: In(userIds) },
      relations: ['units', 'units.troopType'],
    });
    const armiesByUser = new Map<string, Army[]>();
    for (const army of allArmies) {
      const list = armiesByUser.get(army.user_id) ?? [];
      list.push(army);
      armiesByUser.set(army.user_id, list);
    }

    for (const user of users) {
      const userArmies = armiesByUser.get(user.id) ?? [];
      if (userArmies.length === 0) continue;

      const dist = bfsDistances(adjacency, sourcesByUser.get(user.id) ?? [], SUPPLY_BFS_MAX_DEPTH);
      const freeRadius = this.techEffects.supplyRange(user.completed_research ?? []);

      const plans: ArmySupplyPlan[] = userArmies.map((army) => {
        const distance = dist.get(army.province_id) ?? null;
        const multiplier = supplyMultiplierForDistance(distance, freeRadius);
        const need = scaleFoodNeed(computeArmyBaseFoodNeed(army), multiplier);
        army.supply_distance = distance;
        return { army, distance, multiplier, need };
      });

      // Home garrisons (low multiplier) eat before far-flung expeditions; ties broken by army id
      // for a deterministic order.
      plans.sort((a, b) => a.multiplier - b.multiplier || a.army.id.localeCompare(b.army.id));

      const starving: ArmySupplyPlan[] = [];
      for (const plan of plans) {
        if (plan.need.size === 0) continue; // no supply-costed troop types in this army

        const reserved: Array<{ goodId: string; amount: number }> = [];
        let ok = true;
        for (const [goodId, amount] of plan.need) {
          const result = await this.userGoodsService.tryReserve(manager, user.id, goodId, amount);
          if (!result.ok) {
            ok = false;
            break;
          }
          reserved.push({ goodId, amount });
        }

        if (!ok) {
          // Roll back whatever we already reserved for this army — it's all-or-nothing across an
          // army's goods, not a partial payment (mirrors recruit-cost semantics elsewhere).
          for (const r of reserved) {
            await this.userGoodsService.adjustQuantity(manager, user.id, r.goodId, r.amount);
          }
          starving.push(plan);
        }
      }

      for (const plan of starving) {
        await this.applyAttrition(manager, plan.army);
      }

      for (const plan of plans) {
        await manager.update(Army, { id: plan.army.id }, { supply_distance: plan.distance });
      }

      if (starving.length > 0) {
        await this.notifyStarving(manager, user.id, starving.map((p) => p.army));
      }
    }

    this.logger.log('Supply assessed for all users');
  }

  /**
   * Each unit loses SUPPLY_ATTRITION_RATE of its troops (rounded up, so a starving army always
   * loses at least 1 troop per unit rather than rounding away to nothing). Units that drop to 0
   * are deleted outright. If the whole army now falls below ARMY_MIN_SIZE, it's intentionally
   * *not* deleted here — the scheduler's existing disbandWeakArmies() post-processing step
   * catches that later in the same turn, so there's only one place in the codebase that decides
   * "this army is too small to exist."
   */
  private async applyAttrition(manager: EntityManager, army: Army): Promise<void> {
    const survivors: ArmyUnit[] = [];
    const removedIds: string[] = [];
    for (const unit of army.units) {
      const loss = Math.ceil(unit.count * SUPPLY_ATTRITION_RATE);
      unit.count = Math.max(0, unit.count - loss);
      if (unit.count > 0) {
        survivors.push(unit);
      } else {
        removedIds.push(unit.id);
      }
    }

    if (removedIds.length > 0) {
      await manager.delete(ArmyUnit, removedIds);
    }
    if (survivors.length > 0) {
      await manager.save(ArmyUnit, survivors);
    }
    army.units = survivors;
  }

  /**
   * Writes directly through the caller's transactional `manager` rather than going through
   * `NotificationsService` (which uses its own separately-injected repository — a different
   * connection than `manager`). Calling that service from inside this still-open transaction
   * would deadlock: every user's row is already exclusively locked earlier in this same
   * transaction (`IncomeActionService`'s `manager.update(User, ...)`), and the notification
   * INSERT's FK check needs a *shared* lock on that same row from a *different* connection —
   * which can't be granted until this transaction commits, which is itself awaiting the INSERT.
   * Confirmed via `SHOW PROCESSLIST` mid-hang and the resulting `Lock wait timeout exceeded`
   * after exactly MySQL's default 50s `innodb_lock_wait_timeout`, reproducible on every tick.
   */
  private async notifyStarving(manager: EntityManager, userId: string, armies: Army[]): Promise<void> {
    const names = armies.map((a) => a.name || `Army ${a.id.slice(0, 8)}`).join(', ');
    await manager.save(Notification, manager.create(Notification, {
      user_id: userId,
      type: NotificationType.SYSTEM,
      severity: NotificationSeverity.WARNING,
      title: 'Armies Starving',
      message: `${armies.length} of your armies could not be supplied with food this turn and lost troops to attrition: ${names}. Bring them closer to a supply building (Fort, Castle, or Capital) or stockpile more Food.`,
    }));
  }
}
