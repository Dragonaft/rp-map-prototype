import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { User } from '../users/entities/user.entity';
import { UserGameState } from './user-state-loader.service';
import { UserResourcesService } from '../resources/user-resources.service';
import { INCOME_RESEARCH_EFFECTS, RESEARCH_POINT_EFFECTS } from '../techs/research-effects';
import { parseIncome } from "../utils/parseIncome";

/** Runs once per scheduled queue tick before upkeep; credits building income for all users. */
@Injectable()
export class IncomeActionService {
  private readonly logger = new Logger(IncomeActionService.name);

  constructor(private readonly userResourcesService: UserResourcesService) {}

  async execute(state: UserGameState, manager: EntityManager): Promise<void> {
    const { users, provincesByUser } = state;
    if (users.length === 0) return;

    // Resource-ledger income (quantity * plain_income) replaces the old per-turn
    // MINE-building scan — the ledger is already maintained as buildings are
    // built/demolished/conquered, so this is a straight read instead of a re-derivation.
    const resourceIncomeByUser = await this.userResourcesService.sumIncomeForUsers(
      manager, users.map((u) => u.id),
    );

    for (const user of users) {
      const userProvinces = provincesByUser.get(user.id) ?? [];
      let incomeTotal = 0;
      let barracksCount = 0;
      let capitalCount = 1;
      let researchTotal = 0;
      let farmGardenIncome = 0;
      let pietyCount = 0;

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
            case BuildingTypes.MINE:
              // Money from mines now comes from the resource ledger (see resourceIncomeByUser below).
              break;
            case BuildingTypes.TEMPLE: {
              pietyCount += 1;
              incomeTotal += parseIncome(b.income);
              break;
            }
            case BuildingTypes.CATHEDRAL: {
              pietyCount += 2;
              incomeTotal += parseIncome(b.income);
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

      incomeTotal += resourceIncomeByUser.get(user.id) ?? 0;

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
      
      const barracksTroopsIncome = 50;

      if (currentMoney > 0 && barracksCount > 0) {
        user.troops = Number(user.troops ?? 0) + barracksCount * barracksTroopsIncome;
      }

      user.research_points = Number(user.research_points ?? 0) + researchTotal;

      const basePietyIncome = 10; 

      user.piety = Number(user.piety + pietyCount * basePietyIncome)
    }

    for (const user of users) {
      await manager.update(User, { id: user.id }, {
        money: user.money,
        troops: user.troops,
        research_points: user.research_points,
        piety: user.piety,
      });
    }

    this.logger.log('Income credited for all users');
  }
}
