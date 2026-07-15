import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { User } from '../users/entities/user.entity';
import { UserGameState } from './user-state-loader.service';
import { TechEffectsService } from '../techs/tech-effects.service';
import { TechsService } from '../techs/techs.service';
import { UserTechProgressService } from '../techs/user-tech-progress.service';
import { UserClasses } from '../users/types/users.types';
import { parseIncome } from "../utils/parseIncome";

/** Runs once per scheduled queue tick before upkeep; credits building income for all users. */
@Injectable()
export class IncomeActionService {
  private readonly logger = new Logger(IncomeActionService.name);

  constructor(
    private readonly techEffects: TechEffectsService,
    private readonly techsService: TechsService,
    private readonly userTechProgressService: UserTechProgressService,
  ) {}

  async execute(state: UserGameState, manager: EntityManager): Promise<void> {
    const { users, provincesByUser } = state;
    if (users.length === 0) return;

    const techByKey = new Map((await this.techsService.getAll()).map((t) => [t.key, t]));

    for (const user of users) {
      const userProvinces = provincesByUser.get(user.id) ?? [];
      let incomeTotal = 0;
      let barracksCount = 0;
      let capitalCount = 1;
      let researchTotal = 0;
      let farmGardenIncome = 0;
      let pietyCount = 0;

      for (const province of userProvinces) {
        if (province.occupier_id) continue; // occupied: nobody earns from it
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
              incomeTotal += parseIncome(b.income);
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

      const completedResearch = user.completed_research ?? [];

      const incomeCtx = { incomeTotal, barracksCount, farmGardenIncome, provinceCount: userProvinces.length, capitalCount };
      incomeTotal = this.techEffects.apply('income', incomeTotal, incomeCtx, completedResearch);

      const rpCtx = { researchTotal, capitalCount };
      researchTotal = this.techEffects.apply('research_points', researchTotal, rpCtx, completedResearch);

      const currentMoney = Number(user.money ?? 0);
      user.money = currentMoney + incomeTotal;
      
      const barracksTroopsIncome = 50;

      if (currentMoney > 0 && barracksCount > 0) {
        user.troops = Number(user.troops ?? 0) + barracksCount * barracksTroopsIncome;
      }

      // research_points is now a per-turn rate (research speed), not a bankable stockpile —
      // set it fresh each turn rather than accumulating.
      user.research_points = researchTotal;

      const basePietyIncome = 10;

      user.piety = Number(user.piety + pietyCount * basePietyIncome)

      // Accrue this turn's research speed into whichever tech the user has selected as
      // their active research. Completes the tech (and clears the slot) once its saved
      // progress reaches the tech's cost.
      if (user.active_research_key) {
        const activeTech = techByKey.get(user.active_research_key);
        if (!activeTech) {
          // Tech was deleted (e.g. by an admin) out from under an active selection.
          user.active_research_key = null;
        } else {
          const progress = await this.userTechProgressService.addProgress(
            manager, user.id, user.active_research_key, researchTotal,
          );
          if (progress >= activeTech.cost) {
            user.completed_research = [...(user.completed_research ?? []), user.active_research_key];
            await this.userTechProgressService.clearProgress(manager, user.id, user.active_research_key);
            user.active_research_key = null;
            if (activeTech.isClassRoot) {
              user.class = activeTech.branch as UserClasses;
            }
          }
        }
      }
    }

    for (const user of users) {
      await manager.update(User, { id: user.id }, {
        money: user.money,
        troops: user.troops,
        research_points: user.research_points,
        piety: user.piety,
        completed_research: user.completed_research,
        active_research_key: user.active_research_key,
        class: user.class,
      });
    }

    this.logger.log('Income credited for all users');
  }
}
