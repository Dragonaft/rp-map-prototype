import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { User } from '../users/entities/user.entity';
import { Army } from '../armies/entities/army.entity';
import { UserGameState } from './user-state-loader.service';
import { UPKEEP_RESEARCH_EFFECTS } from '../techs/research-effects';

function parseUpkeep(upkeep: string | null | undefined): number {
  const n = Number(upkeep);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const ARMY_UPKEEP_BUILDINGS = new Set<string>([
  BuildingTypes.FORT,
  BuildingTypes.BARRACKS,
  BuildingTypes.ARMORY,
]);

/** Runs once per scheduled queue tick before any queued player actions. */
@Injectable()
export class UpkeepActionService {
  private readonly logger = new Logger(UpkeepActionService.name);

  async execute(state: UserGameState, manager: EntityManager): Promise<void> {
    const { users, provincesByUser } = state;
    if (users.length === 0) return;

    // Load all armies (with units + troop types) for all users in a single query
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
      const userProvinces = provincesByUser.get(user.id) ?? [];
      const userArmies = armiesByUser.get(user.id) ?? [];

      // Building upkeep (FORT, BARRACKS, ARMORY)
      let buildingUpkeep = 0;
      for (const province of userProvinces) {
        if (!province.buildings?.length) continue;
        for (const b of province.buildings) {
          if (ARMY_UPKEEP_BUILDINGS.has(b.type)) {
            buildingUpkeep += parseUpkeep(b.upkeep as any);
          }
        }
      }

      // Army upkeep: flat_upkeep per army + per-unit-type upkeep
      let armyUpkeep = 0;
      for (const army of userArmies) {
        armyUpkeep += army.flat_upkeep;
        for (const unit of army.units ?? []) {
          const upkeepPer100 = unit.troopType?.upkeep_per_100 ?? 0;
          armyUpkeep += Math.ceil(Math.max(0, unit.count) / 100) * upkeepPer100;
        }
      }

      const upkeepCtx = { totalUpkeep: buildingUpkeep + armyUpkeep };
      for (const techKey of (user.completed_research ?? [])) {
        UPKEEP_RESEARCH_EFFECTS[techKey]?.(upkeepCtx);
      }
      user.money = Math.max(0, Number(user.money ?? 0) - upkeepCtx.totalUpkeep);
    }

    for (const user of users) {
      await manager.update(User, { id: user.id }, { money: user.money });
    }

    this.logger.log('Upkeep applied for all users');
  }
}
