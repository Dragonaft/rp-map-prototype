import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { Building } from '../buildings/entities/building.entity';
import { Province } from '../provinces/entities/province.entity';
import { User } from '../users/entities/user.entity';

function parseUpkeep(upkeep: string | null | undefined): number {
  const n = Number(upkeep);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Runs once per scheduled queue tick before any queued player actions. */
@Injectable()
export class UpkeepActionService {
  private readonly logger = new Logger(UpkeepActionService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async execute(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const fortBarracksTemplates = await manager.find(Building, {
        where: { type: In([BuildingTypes.FORT, BuildingTypes.BARRACKS]) },
      });
      const hasFortOrBarracksInDb = fortBarracksTemplates.length > 0;

      const users = await manager.find(User);
      if (users.length === 0) {
        return;
      }

      const userIds = users.map((u) => u.id);
      const ownedProvinces = await manager.find(Province, {
        where: { user_id: In(userIds) },
        relations: ['buildings'],
      });

      const provincesByUser = new Map<string, Province[]>();
      for (const p of ownedProvinces) {
        if (!p.user_id) {
          continue;
        }
        const list = provincesByUser.get(p.user_id) ?? [];
        list.push(p);
        provincesByUser.set(p.user_id, list);
      }

      for (const user of users) {
        const userProvinces = provincesByUser.get(user.id) ?? [];
        let deployedTroops = 0;
        let buildingUpkeep = 0;

        for (const province of userProvinces) {
          deployedTroops += Number(province.local_troops ?? 0);
          if (!hasFortOrBarracksInDb || !province.buildings?.length) {
            continue;
          }
          for (const b of province.buildings) {
            if (b.type === BuildingTypes.FORT || b.type === BuildingTypes.BARRACKS) {
              buildingUpkeep += parseUpkeep(b.upkeep);
            }
          }
        }

        const troopUpkeep = Math.ceil(Math.max(0, deployedTroops) / 200) * 100;
        const totalUpkeep = buildingUpkeep + troopUpkeep;
        const currentMoney = Number(user.money ?? 0);
        user.money = Math.max(0, currentMoney - totalUpkeep);
      }

      for (const user of users) {
        await manager.update(User, { id: user.id }, { money: user.money });
      }
    });

    this.logger.log('Upkeep applied for all users');
  }
}
