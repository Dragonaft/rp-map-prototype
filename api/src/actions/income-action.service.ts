import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { Province } from '../provinces/entities/province.entity';
import { User } from '../users/entities/user.entity';

function parseIncome(income: string | null | undefined): number {
  const n = Number(income);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Runs once per scheduled queue tick before upkeep; credits building income for all users. */
@Injectable()
export class IncomeActionService {
  private readonly logger = new Logger(IncomeActionService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async execute(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
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
        let incomeTotal = 0;

        for (const province of userProvinces) {
          if (!province.buildings?.length) {
            continue;
          }
          for (const b of province.buildings) {
            if (b.type === BuildingTypes.FORT || b.type === BuildingTypes.BARRACKS) {
              continue;
            }
            incomeTotal += parseIncome(b.income);
          }
        }

        const currentMoney = Number(user.money ?? 0);
        user.money = currentMoney + incomeTotal;
      }

      for (const user of users) {
        await manager.update(User, { id: user.id }, { money: user.money });
      }
    });

    this.logger.log('Income credited for all users');
  }
}
