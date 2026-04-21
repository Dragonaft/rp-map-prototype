import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { Building } from '../buildings/entities/building.entity';
import { Province } from '../provinces/entities/province.entity';
import { User } from '../users/entities/user.entity';
import { ActionQueue, ActionType } from './entities/action-queue.entity';
import { TechsService } from '../techs/techs.service';
import { BATTLE_RESEARCH_EFFECTS, computeBuildingCap } from '../techs/research-effects';

const DEFENSIVE_BUILDING_TYPES = new Set<string>([
  BuildingTypes.FORT,
  BuildingTypes.CAPITOL,
  BuildingTypes.CAPITAL,
]);

/** Buildings that can only be placed on provinces whose resource_type is in the allowed list. */
const RESOURCE_BUILDING_REQUIREMENTS: Partial<Record<BuildingTypes, string[]>> = {
  [BuildingTypes.MINE]:     ['iron', 'gold', 'stone'],
  [BuildingTypes.FORESTRY]: ['wood'],
  [BuildingTypes.FARM]:     ['grain'],
};

/** Server-side money cost per troop when moving troops from the global pool into a province. Maybe transfer to env or db */
const DEPLOY_MONEY_PER_TROOP = 1;
const UNIQUE_PER_PROVINCE: string[] = [BuildingTypes.MINE, BuildingTypes.FORESTRY, BuildingTypes.FORT];

function parseBuildingModifier(modifier: string | null | undefined): number {
  const n = Number(modifier);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function computeBuildModifier(buildings: Building[] | undefined): number {
  if (!buildings?.length) {
    return 1;
  }
  let sum = 0;
  for (const b of buildings) {
    if (DEFENSIVE_BUILDING_TYPES.has(b.type)) {
      sum += parseBuildingModifier(b.modifier);
    }
  }
  return sum > 0 ? sum : 1;
}

export interface ActionHandler {
  handle(action: ActionQueue): Promise<void>;
}

@Injectable()
export class BuildActionHandler implements ActionHandler {
  private readonly logger = new Logger(BuildActionHandler.name);

  constructor(
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing BUILD action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    const provinceId = action.actionData?.province_id as string | undefined;
    const buildingId = action.actionData?.building_id as string | undefined;

    if (!provinceId || !buildingId) {
      throw new Error('province_id and building_id are required');
    }

    await this.provinceRepo.manager.transaction(async (manager) => {
      const province = await manager.findOne(Province, {
        where: { id: provinceId },
        relations: ['buildings'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!province) {
        throw new Error('Province not found');
      }

      if (province.user_id !== action.userId) {
        throw new Error('User does not own this province');
      }

      const buildingTemplate = await manager.findOne(Building, {
        where: { id: buildingId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!buildingTemplate) {
        throw new Error('Building not found');
      }

      const cost = Number(buildingTemplate.cost ?? 0);
      if (!Number.isFinite(cost) || cost < 0) {
        throw new Error('Invalid building cost');
      }

      const user = await manager.findOne(User, {
        where: { id: action.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentMoney = Number(user.money ?? 0);
      if (currentMoney < cost) {
        throw new Error('Not enough money to build');
      }

      const buildingCap = computeBuildingCap(province.landscape, user.completed_research ?? []);
      if ((province.buildings?.length ?? 0) >= buildingCap) {
        throw new Error(`Building cap reached for this province (max ${buildingCap})`);
      }

      if (UNIQUE_PER_PROVINCE.includes(buildingTemplate.type)) {
        const alreadyHasType = province.buildings?.some(
          (b) => b.type === buildingTemplate.type,
        );
        if (alreadyHasType) {
          throw new Error('This building type is already built in this province');
        }
      }

      const allowedResources = RESOURCE_BUILDING_REQUIREMENTS[buildingTemplate.type];
      if (allowedResources && !allowedResources.includes(province.resource_type)) {
        throw new Error(
          `${buildingTemplate.name} can only be built on provinces with resource type: ${allowedResources.join(', ')} (this province: ${province.resource_type ?? 'none'})`,
        );
      }

      user.money = currentMoney - cost;
      await manager.save(User, user);

      await manager
        .createQueryBuilder()
        .relation(Province, 'buildings')
        .of(provinceId)
        .add(buildingId);
    });
  }
}

@Injectable()
export class InvadeActionHandler implements ActionHandler {
  private readonly logger = new Logger(InvadeActionHandler.name);

  constructor(
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing INVADE action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    const fromId = action.actionData?.from_province_id as string | undefined;
    const toId = action.actionData?.to_province_id as string | undefined;
    const troopsNumber = Number(action.actionData?.troops_number ?? 0);

    if (!fromId || !toId) {
      throw new Error('from_province_id and to_province_id are required');
    }
    if (!Number.isFinite(troopsNumber) || troopsNumber <= 0) {
      throw new Error('troops_number must be a positive number');
    }

    await this.provinceRepo.manager.transaction(async (manager) => {
      const fromProvince = await manager.findOne(Province, {
        where: { id: fromId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromProvince) {
        throw new Error('Source province not found');
      }

      if (fromProvince.user_id !== action.userId) {
        throw new Error('User do not own the source province');
      }

      const fromTroops = Number(fromProvince.local_troops ?? 0);
      if (!Number.isFinite(fromTroops) || fromTroops < troopsNumber) {
        throw new Error('Not enough troops in the source province');
      }

      const toProvince = await manager.findOne(Province, {
        where: { id: toId },
        relations: ['buildings'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!toProvince) {
        throw new Error('Target province not found');
      }

      const defenderTroops = Number(toProvince.local_troops ?? 0);
      if (!Number.isFinite(defenderTroops)) {
        throw new Error('Invalid defender troop count on target province');
      }

      if (action.userId != null && action.userId !== action.userId) {
        throw new Error('actionData.userId does not match action user');
      }
      if (
        toProvince.user_id != null &&
        action.userId === toProvince.user_id
      ) {
        fromProvince.local_troops = fromTroops - troopsNumber;
        toProvince.local_troops = defenderTroops + troopsNumber;
        await manager.save(Province, [fromProvince, toProvince]);
        return;
      }

      const attacker = await manager.findOne(User, { where: { id: action.userId } });
      const battleCtx = { attackingTroops: troopsNumber };
      for (const techKey of (attacker?.completed_research ?? [])) {
        BATTLE_RESEARCH_EFFECTS[techKey]?.(battleCtx);
      }

      const buildModifier = computeBuildModifier(toProvince.buildings);
      const battleResult = battleCtx.attackingTroops / buildModifier - defenderTroops;

      fromProvince.local_troops = fromTroops - troopsNumber;

      if (battleResult > 0) {
        const isWater = toProvince.type?.toLowerCase() === 'water';
        if (!isWater) {
          toProvince.user_id = action.userId;
        }
        toProvince.local_troops = Math.round(battleResult);
      } else if (battleResult < 0) {
        toProvince.local_troops = Math.round(-battleResult);
      } else {
        toProvince.local_troops = 0;
      }

      await manager.save(Province, [fromProvince, toProvince]);
    });
  }
}

@Injectable()
export class DeployActionHandler implements ActionHandler {
  private readonly logger = new Logger(DeployActionHandler.name);

  constructor(
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing DEPLOY action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    const provinceId = action.actionData?.province_id as string | undefined;
    const troopsNumber = Number(action.actionData?.troops_number ?? 0);

    if (!provinceId) {
      throw new Error('province_id is required');
    }
    if (!Number.isFinite(troopsNumber) || troopsNumber <= 0) {
      throw new Error('troops_number must be a positive number');
    }

    await this.provinceRepo.manager.transaction(async (manager) => {
      const province = await manager.findOne(Province, {
        where: { id: provinceId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!province) {
        throw new Error('Province not found');
      }

      if (province.user_id !== action.userId) {
        throw new Error('User does not own this province');
      }

      const user = await manager.findOne(User, {
        where: { id: action.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const hasLogistics = (user.completed_research ?? []).includes('economy.logistics');
      const deployMoneyCost = hasLogistics ? 0 : troopsNumber * DEPLOY_MONEY_PER_TROOP;

      const currentMoney = Number(user.money ?? 0);
      if (currentMoney < deployMoneyCost) {
        throw new Error('Not enough money to deploy');
      }

      const poolTroops = Number(user.troops ?? 0);
      if (!Number.isFinite(poolTroops) || poolTroops < troopsNumber) {
        throw new Error('Not enough troops to deploy');
      }

      const localTroops = Number(province.local_troops ?? 0);
      const safeLocal = Number.isFinite(localTroops) ? localTroops : 0;

      user.money = currentMoney - deployMoneyCost;
      user.troops = poolTroops - troopsNumber;
      province.local_troops = safeLocal + troopsNumber;

      await manager.save(Province, province);
      await manager.save(User, user);
    });
  }
}

@Injectable()
export class UpgradeActionHandler implements ActionHandler {
  private readonly logger = new Logger(UpgradeActionHandler.name);

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing UPGRADE action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    // TODO: Implement actual upgrade logic

    // Simulated execution
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

@Injectable()
export class TransferTroopsActionHandler implements ActionHandler {
  private readonly logger = new Logger(TransferTroopsActionHandler.name);

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing TRANSFER_TROOPS action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    // TODO: Implement actual troop transfer logic

    // Simulated execution
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

@Injectable()
export class ResearchActionHandler implements ActionHandler {
  private readonly logger = new Logger(ResearchActionHandler.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly techsService: TechsService,
  ) {}

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing RESEARCH action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    const techKey = action.actionData?.tech_key as string | undefined;
    if (!techKey) {
      throw new Error('tech_key is required');
    }

    await this.userRepo.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: action.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const tech = await this.techsService.getByKey(techKey);

      const completed = user.completed_research ?? [];

      if (completed.includes(techKey)) {
        throw new Error(`Tech already researched: ${techKey}`);
      }

      const missingPrereq = (tech.prerequisites ?? []).find(
        (prereq) => !completed.includes(prereq),
      );
      if (missingPrereq) {
        throw new Error(`Missing prerequisite tech: ${missingPrereq}`);
      }

      if (tech.isClassRoot) {
        if (user.class !== null && user.class !== undefined) {
          throw new Error('Class already selected, cannot research another class root tech');
        }
      } else if (tech.branch.startsWith('class.')) {
        if (!user.class || user.class !== tech.branch) {
          throw new Error(`This tech requires class: ${tech.branch}`);
        }
      }

      const currentPoints = Number(user.research_points ?? 0);
      if (currentPoints < tech.cost) {
        throw new Error(`Not enough research points (have ${currentPoints}, need ${tech.cost})`);
      }

      user.research_points = currentPoints - tech.cost;
      user.completed_research = [...completed, techKey];

      if (tech.isClassRoot) {
        user.class = tech.branch;
      }

      await manager.save(User, user);
    });
  }
}

@Injectable()
export class ActionExecutorService {
  private readonly logger = new Logger(ActionExecutorService.name);
  private handlers = new Map<ActionType, ActionHandler>();

  constructor(
    private buildHandler: BuildActionHandler,
    private invadeHandler: InvadeActionHandler,
    private deployHandler: DeployActionHandler,
    private upgradeHandler: UpgradeActionHandler,
    private transferTroopsHandler: TransferTroopsActionHandler,
    private researchHandler: ResearchActionHandler,
  ) {
    this.handlers.set(ActionType.BUILD, buildHandler);
    this.handlers.set(ActionType.INVADE, invadeHandler);
    this.handlers.set(ActionType.DEPLOY, deployHandler);
    this.handlers.set(ActionType.UPGRADE, upgradeHandler);
    this.handlers.set(ActionType.TRANSFER_TROOPS, transferTroopsHandler);
    this.handlers.set(ActionType.RESEARCH, researchHandler);
  }

  async executeAction(action: ActionQueue): Promise<{
    success: boolean;
    error?: string;
  }> {
    const handler = this.handlers.get(action.actionType);

    if (!handler) {
      const error = `No handler found for action type: ${action.actionType}`;
      this.logger.error(error);
      return { success: false, error };
    }

    try {
      await handler.handle(action);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to execute action ${action.id}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { success: false, error: errorMessage };
    }
  }
}
