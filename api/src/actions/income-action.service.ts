import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { User } from '../users/entities/user.entity';
import { UserGameState } from './user-state-loader.service';
import { INCOME_RESEARCH_EFFECTS, RESEARCH_POINT_EFFECTS } from '../techs/research-effects';

function parseIncome(income: string | number | null | undefined): number {
  const n = Number(income);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const MINE_INCOME_BY_RESOURCE: Record<string, number> = {
  stone: 100,
  iron:  150,
  gold:  400,
};

/** Runs once per scheduled queue tick before upkeep; credits building income for all users. */
@Injectable()
export class IncomeActionService {
  private readonly logger = new Logger(IncomeActionService.name);

  async execute(state: UserGameState, manager: EntityManager): Promise<void> {
    const { users, provincesByUser } = state;
    if (users.length === 0) return;

    for (const user of users) {
      const userProvinces = provincesByUser.get(user.id) ?? [];
      let incomeTotal = 0;
      let barracksCount = 0;
      let capitalCount = 1;
      let researchTotal = 0;
      let farmGardenIncome = 0;

      for (const province of userProvinces) {
        if (!province.buildings?.length) continue;
        for (const b of province.buildings) {
          switch (b.type) {
            case BuildingTypes.BARRACKS:
              barracksCount++;
              break;
            case BuildingTypes.CAPITAL:
              barracksCount++;
              researchTotal++;
              incomeTotal += parseIncome(b.income);
              break;
            case BuildingTypes.LIBRARY:
              researchTotal++;
              break;
            case BuildingTypes.FORT:
              break;
            case BuildingTypes.FARM:
            case BuildingTypes.GARDEN:
              farmGardenIncome += parseIncome(b.income);
              incomeTotal += parseIncome(b.income);
              break;
            case BuildingTypes.MINE: {
              const mineIncome = MINE_INCOME_BY_RESOURCE[province.resource_type] ?? 0;
              incomeTotal += mineIncome;
              break;
            }
            case BuildingTypes.FORESTRY:
              incomeTotal += parseIncome(b.income);
              break;
            default:
              incomeTotal += parseIncome(b.income);
          }
        }
      }

      const completedResearch = user.completed_research ?? [];

      const incomeCtx = { incomeTotal, barracksCount, farmGardenIncome, provinceCount: userProvinces.length, capitalCount };
      for (const techKey of completedResearch) {
        INCOME_RESEARCH_EFFECTS[techKey]?.(incomeCtx);
      }
      incomeTotal = incomeCtx.incomeTotal;

      const rpCtx = { researchTotal, capitalCount };
      for (const techKey of completedResearch) {
        RESEARCH_POINT_EFFECTS[techKey]?.(rpCtx);
      }
      researchTotal = rpCtx.researchTotal;

      const currentMoney = Number(user.money ?? 0);
      user.money = currentMoney + incomeTotal;

      if (currentMoney > 0 && barracksCount > 0) {
        user.troops = Number(user.troops ?? 0) + barracksCount * 50;
      }

      user.research_points = Number(user.research_points ?? 0) + researchTotal;
    }

    for (const user of users) {
      await manager.update(User, { id: user.id }, {
        money: user.money,
        troops: user.troops,
        research_points: user.research_points,
      });
    }

    this.logger.log('Income credited for all users');
  }
}
