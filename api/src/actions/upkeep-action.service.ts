import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { User } from '../users/entities/user.entity';
import { UserGameState } from './user-state-loader.service';

function parseUpkeep(upkeep: string | null | undefined): number {
  const n = Number(upkeep);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Runs once per scheduled queue tick before any queued player actions. */
@Injectable()
export class UpkeepActionService {
  private readonly logger = new Logger(UpkeepActionService.name);

  async execute(state: UserGameState, manager: EntityManager): Promise<void> {
    const { users, provincesByUser } = state;
    if (users.length === 0) return;

    for (const user of users) {
      const userProvinces = provincesByUser.get(user.id) ?? [];
      let deployedTroops = 0;
      let buildingUpkeep = 0;

      for (const province of userProvinces) {
        deployedTroops += Number(province.local_troops ?? 0);
        if (!province.buildings?.length) continue;
        for (const b of province.buildings) {
          if (b.type === BuildingTypes.FORT || b.type === BuildingTypes.BARRACKS) {
            buildingUpkeep += parseUpkeep(b.upkeep);
          }
        }
      }

      const troopUpkeep = Math.ceil(Math.max(0, deployedTroops) / 200) * 100;
      const totalUpkeep = buildingUpkeep + troopUpkeep;
      user.money = Math.max(0, Number(user.money ?? 0) - totalUpkeep);
    }

    for (const user of users) {
      await manager.update(User, { id: user.id }, { money: user.money });
    }

    this.logger.log('Upkeep applied for all users');
  }
}
