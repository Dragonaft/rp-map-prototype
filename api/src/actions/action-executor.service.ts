import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { Building } from '../buildings/entities/building.entity';
import { Province } from '../provinces/entities/province.entity';
import { User } from '../users/entities/user.entity';
import { ActionQueue, ActionType } from './entities/action-queue.entity';
import { TechsService } from '../techs/techs.service';
import { BATTLE_RESEARCH_EFFECTS, computeBuildingCap } from '../techs/research-effects';
import { Army } from '../armies/entities/army.entity';
import { ArmyUnit } from '../armies/entities/army-unit.entity';
import { TroopType } from '../armies/entities/troop-type.entity';
import { UserClasses } from "../users/types/users.types";
import {
  ARMY_MIN_SIZE,
  CASUALTY_FLOOR,
  applyCasualties,
  armyAttackPower,
  armyDefensePower,
  armyTotalTroops,
  computeBuildModifier,
} from './combat-calculator';

const NO_BUILD_TYPES = new Set<string>([
  BuildingTypes.CAPITOL,
  BuildingTypes.CAPITAL,
]);

/** Buildings that can only be placed on provinces whose resource_type is in the allowed list. */
const RESOURCE_BUILDING_REQUIREMENTS: Partial<Record<BuildingTypes, string[]>> = {
  [BuildingTypes.MINE]:     ['iron', 'gold', 'stone'],
  [BuildingTypes.FORESTRY]: ['wood'],
  [BuildingTypes.FARM]:     ['grain'],
};

// TODO: Make these values dynamic
/** Server-side money cost per troop when moving troops from the global pool into a province. Maybe transfer to env or db */
const DEPLOY_MONEY_PER_TROOP = 1;
const UNIQUE_PER_PROVINCE: string[] = [BuildingTypes.MINE, BuildingTypes.FORESTRY, BuildingTypes.FORT];
const REMOVE_COST = 100;

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

      if (NO_BUILD_TYPES.has(buildingTemplate.type)) {
        throw new Error('Building is not allowed to build');
      }

      const user = await manager.findOne(User, {
        where: { id: action.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const requiredTech = buildingTemplate.requirement_tech ?? [];
      const completedResearch = user.completed_research ?? [];
      const missingTech = requiredTech.filter((tech) => !completedResearch.includes(tech));
      if (missingTech.length > 0) {
        throw new Error(`Missing required research: ${missingTech.join(', ')}`);
      }

      const cost = Number(buildingTemplate.cost ?? 0);
      if (!Number.isFinite(cost) || cost < 0) {
        throw new Error('Invalid building cost');
      }

      const currentMoney = Number(user.money ?? 0);
      if (currentMoney < cost) {
        throw new Error('Not enough money to build');
      }

      const buildingCap = computeBuildingCap(province.landscape, completedResearch);
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
export class RemoveActionHandler implements ActionHandler {
  private readonly logger = new Logger(RemoveActionHandler.name);

  constructor(
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing REMOVE action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
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

      const buildingExists = province.buildings?.some((b) => b.id === buildingId);
      if (!buildingExists) {
        throw new Error('Building not found in this province');
      }

      const user = await manager.findOne(User, {
        where: { id: action.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentMoney = Number(user.money ?? 0);
      if (currentMoney < REMOVE_COST) {
        throw new Error(`Not enough money to remove building (cost: ${REMOVE_COST})`);
      }

      user.money = currentMoney - REMOVE_COST;
      await manager.save(User, user);

      await manager
        .createQueryBuilder()
        .relation(Province, 'buildings')
        .of(provinceId)
        .remove(buildingId);
    });
  }
}

@Injectable()
export class UpgradeActionHandler implements ActionHandler {
  private readonly logger = new Logger(UpgradeActionHandler.name);

  constructor(
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing UPGRADE action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
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

      const currentBuilding = province.buildings?.find((b) => b.id === buildingId);
      if (!currentBuilding) {
        throw new Error('Building not found in this province');
      }

      if (!currentBuilding.upgrade_to) {
        throw new Error('This building cannot be upgraded');
      }

      const upgradeBuilding = await manager.findOne(Building, {
        where: { type: currentBuilding.upgrade_to },
        lock: { mode: 'pessimistic_write' },
      });

      if (!upgradeBuilding) {
        throw new Error(`Upgrade target building type not found: ${currentBuilding.upgrade_to}`);
      }

      if (upgradeBuilding.requirement_building !== currentBuilding.type) {
        throw new Error(
          `Upgrade chain mismatch: ${upgradeBuilding.type} requires ${upgradeBuilding.requirement_building}, not ${currentBuilding.type}`,
        );
      }

      const cost = Number(upgradeBuilding.cost ?? 0);
      if (!Number.isFinite(cost) || cost < 0) {
        throw new Error('Invalid upgrade building cost');
      }

      const user = await manager.findOne(User, {
        where: { id: action.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const allowedResources = RESOURCE_BUILDING_REQUIREMENTS[upgradeBuilding.type];
      if (allowedResources && !allowedResources.includes(province.resource_type)) {
        throw new Error(
          `${upgradeBuilding.name} can only be built on provinces with resource type: ${allowedResources.join(', ')} (this province: ${province.resource_type ?? 'none'})`,
        );
      }

      const completedResearch = user.completed_research ?? [];
      const missingTech = (upgradeBuilding.requirement_tech ?? []).find(
        (tech) => !completedResearch.includes(tech),
      );
      if (missingTech) {
        throw new Error(`Missing required technology to upgrade: ${missingTech}`);
      }

      const currentMoney = Number(user.money ?? 0);
      if (currentMoney < cost) {
        throw new Error('Not enough money to upgrade');
      }

      user.money = currentMoney - cost;
      await manager.save(User, user);

      await manager
        .createQueryBuilder()
        .relation(Province, 'buildings')
        .of(provinceId)
        .remove(buildingId);

      await manager
        .createQueryBuilder()
        .relation(Province, 'buildings')
        .of(provinceId)
        .add(upgradeBuilding.id);
    });
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
      } else if (tech.branch.startsWith(UserClasses.GUILD || UserClasses.HOLY || UserClasses.NOBLE)) {
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
        user.class = tech.branch as UserClasses;
      }

      await manager.save(User, user);
    });
  }
}

// ---------------------------------------------------------------------------
// Army action handlers
// ---------------------------------------------------------------------------

interface RecruitEntry {
  troop_type_key: string;
  count: number;
}

// Troop types that require a specific player class to recruit
const CLASS_RESTRICTED_TROOPS: Partial<Record<string, UserClasses>> = {
  'noble_knights': UserClasses.NOBLE,
  'paladins':      UserClasses.HOLY,
  'mercenaries':   UserClasses.GUILD,
};

// Troop types whose recruitment cost is paid in piety instead of money
const PIETY_COST_TROOPS = new Set(['paladins']);

// Troop types that do NOT consume the draft pool (user.troops) on recruitment
const NO_POOL_TROOPS = new Set(['mercenaries']);

/** Validates and executes troop recruitment into an army within a transaction. */
const executeRecruitment = async (
  manager: EntityManager,
  userId: string,
  army: Army,
  recruits: RecruitEntry[],
): Promise<void> => {
  const user = await manager.findOne(User, {
    where: { id: userId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!user) throw new Error('User not found');

  // Validate each recruit entry
  for (const entry of recruits) {
    if (!Number.isFinite(entry.count) || entry.count <= 0) {
      throw new Error(`Invalid count for troop type "${entry.troop_type_key}"`);
    }

    const troopType = await manager.findOne(TroopType, { where: { key: entry.troop_type_key } });
    if (!troopType) throw new Error(`Unknown troop type: ${entry.troop_type_key}`);

    // Class requirement check
    const requiredClass = CLASS_RESTRICTED_TROOPS[entry.troop_type_key];
    if (requiredClass && user.class !== requiredClass) {
      throw new Error(`Only ${requiredClass} class can recruit ${troopType.name}`);
    }

    // Tech requirement check
    if (troopType.tech_requirement) {
      const hasTech = (user.completed_research ?? []).includes(troopType.tech_requirement);
      if (!hasTech) {
        throw new Error(`Technology required to recruit ${troopType.name}: ${troopType.tech_requirement}`);
      }
    }

    // Building requirement: user must own at least one province containing that building type
    if (troopType.building_requirement) {
      const buildingInProvince = await manager
        .createQueryBuilder(Province, 'p')
        .innerJoin('p.buildings', 'b', 'b.type = :btype', { btype: troopType.building_requirement })
        .where('p.user_id = :uid', { uid: userId })
        .getOne();
      if (!buildingInProvince) {
        throw new Error(
          `A ${troopType.building_requirement} building is required in at least one owned province to recruit ${troopType.name}`,
        );
      }
    }

    // Draft pool deduction (mercenaries bypass this — hired directly with money)
    if (!NO_POOL_TROOPS.has(entry.troop_type_key)) {
      const pool = Number(user.troops ?? 0);
      if (pool < entry.count) {
        throw new Error(
          `Not enough troops in the draft pool (have ${pool}, need ${entry.count})`,
        );
      }
      user.troops = pool - entry.count;
    }

    // Recruitment cost
    if (troopType.cost_per_100 > 0) {
      const cost = Math.ceil((entry.count / 100) * troopType.cost_per_100);

      if (PIETY_COST_TROOPS.has(entry.troop_type_key)) {
        // Paladins are paid for with piety
        const piety = Number(user.piety ?? 0);
        if (piety < cost) {
          throw new Error(
            `Not enough piety to recruit ${entry.count} ${troopType.name} (need ${cost}, have ${piety})`,
          );
        }
        user.piety = piety - cost;
      } else {
        const money = Number(user.money ?? 0);
        if (money < cost) {
          throw new Error(
            `Not enough money to recruit ${entry.count} ${troopType.name} (need ${cost}, have ${money})`,
          );
        }
        user.money = money - cost;
      }
    }

    // Add/update unit in army
    let unit = army.units.find((u) => u.troopType.key === entry.troop_type_key);
    if (!unit) {
      unit = manager.create(ArmyUnit, {
        army_id: army.id,
        troop_type_id: troopType.id,
        troopType,
        count: 0,
      });
      army.units.push(unit);
    }
    unit.count += entry.count;
  }

  await manager.save(User, user);
}

/** Returns true if the province has a Road building. */
const hasRoadBuilding = (province: Province): boolean => {
  return (province.buildings ?? []).some((b) => b.type === BuildingTypes.ROAD);
}

/**
 * BFS: returns true if `targetId` is reachable from `from` within `maxHops` steps via roads.
 * Every intermediate province must be owned by `userId` and have a Road building.
 * The `from` province is assumed to already have a Road before calling this.
 */
const isReachableByRoad = async (
  manager: EntityManager,
  from: Province,
  targetId: string,
  userId: string,
  maxHops: number,
): Promise<boolean> => {
  const visited = new Set<string>([from.id]);
  let frontier: Province[] = [from];

  for (let hop = 0; hop < maxHops; hop++) {
    const nextFrontier: Province[] = [];

    for (const current of frontier) {
      for (const neighborId of (current.neighbor_ids ?? [])) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighbor = await manager.findOne(Province, {
          where: { id: neighborId },
          relations: ['buildings'],
        });
        if (!neighbor || !hasRoadBuilding(neighbor) || neighbor.user_id !== userId) continue;

        if (neighborId === targetId) return true;

        // Expand through user-owned road provinces only (not needed on the last hop)
        if (hop < maxHops - 1) {
          nextFrontier.push(neighbor);
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  return false;
}

@Injectable()
export class ArmyCreateHandler implements ActionHandler {
  private readonly logger = new Logger(ArmyCreateHandler.name);

  constructor(
    @InjectRepository(Army)
    private readonly armyRepo: Repository<Army>,
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  handle = async (action: ActionQueue): Promise<void> => {
    this.logger.log(`Executing ARMY_CREATE for user ${action.userId}`);

    const provinceId = action.actionData?.province_id as string | undefined;
    const name = action.actionData?.name as string | undefined;
    const recruits = (action.actionData?.units ?? []) as RecruitEntry[];

    if (!provinceId) throw new Error('province_id is required');
    if (!recruits.length) throw new Error('units array must not be empty');

    await this.armyRepo.manager.transaction(async (manager) => {
      const province = await manager.findOne(Province, {
        where: { id: provinceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!province) throw new Error('Province not found');
      if (province.user_id !== action.userId) throw new Error('User does not own this province');

      const army = manager.create(Army, {
        name: name ?? null,
        user_id: action.userId,
        province_id: provinceId,
        flat_upkeep: 100,
        units: [],
      });
      // Persist army first so we have an id for units
      const savedArmy = await manager.save(Army, army);
      savedArmy.units = [];

      await executeRecruitment(manager, action.userId, savedArmy, recruits);

      const total = armyTotalTroops(savedArmy);
      if (total < ARMY_MIN_SIZE) {
        throw new Error(`Army must contain at least ${ARMY_MIN_SIZE} troops (currently ${total})`);
      }

      await manager.save(ArmyUnit, savedArmy.units);
    });
  }
}

@Injectable()
export class ArmyRecruitHandler implements ActionHandler {
  private readonly logger = new Logger(ArmyRecruitHandler.name);

  constructor(
    @InjectRepository(Army)
    private readonly armyRepo: Repository<Army>,
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  handle = async (action: ActionQueue): Promise<void> => {
    this.logger.log(`Executing ARMY_RECRUIT for user ${action.userId}`);

    const armyId = action.actionData?.army_id as string | undefined;
    const recruits = (action.actionData?.units ?? []) as RecruitEntry[];

    if (!armyId) throw new Error('army_id is required');
    if (!recruits.length) throw new Error('units array must not be empty');

    await this.armyRepo.manager.transaction(async (manager) => {
      const army = await manager.findOne(Army, {
        where: { id: armyId },
        relations: ['units', 'units.troopType'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!army) throw new Error('Army not found');
      if (army.user_id !== action.userId) throw new Error('User does not own this army');

      // Army must be in an owned province to recruit
      const province = await manager.findOne(Province, { where: { id: army.province_id } });
      if (!province || province.user_id !== action.userId) {
        throw new Error('Army must be stationed in an owned province to recruit');
      }

      await executeRecruitment(manager, action.userId, army, recruits);
      await manager.save(ArmyUnit, army.units);
    });
  }
}

@Injectable()
export class ArmyMoveHandler implements ActionHandler {
  private readonly logger = new Logger(ArmyMoveHandler.name);

  constructor(
    @InjectRepository(Army)
    private readonly armyRepo: Repository<Army>,
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  handle = async (action: ActionQueue): Promise<void> => {
    this.logger.log(`Executing ARMY_MOVE for user ${action.userId}`);

    const armyId = action.actionData?.army_id as string | undefined;
    const toProvinceId = action.actionData?.to_province_id as string | undefined;

    if (!armyId || !toProvinceId) throw new Error('army_id and to_province_id are required');

    await this.armyRepo.manager.transaction(async (manager) => {
      const army = await manager.findOne(Army, {
        where: { id: armyId },
        relations: ['units', 'units.troopType'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!army) throw new Error('Army not found');
      if (army.user_id !== action.userId) throw new Error('User does not own this army');

      const fromProvince = await manager.findOne(Province, {
        where: { id: army.province_id },
        relations: ['buildings'],
      });
      if (!fromProvince) throw new Error('Source province not found');

      const attacker = await manager.findOne(User, { where: { id: action.userId } });
      const completedResearch = attacker?.completed_research ?? [];

      const neighborIds: string[] = fromProvince.neighbor_ids ?? [];
      const isDirectlyAdjacent = neighborIds.includes(toProvinceId);

      if (!isDirectlyAdjacent) {
        if (!hasRoadBuilding(fromProvince)) {
          throw new Error('Target province is not adjacent to the army\'s current province');
        }
        // Default road reach: 2 hops; extended to 3 with military.best_logistics
        const maxRoadHops = completedResearch.includes('military.best_logistics') ? 3 : 2;
        const canReach = await isReachableByRoad(manager, fromProvince, toProvinceId, action.userId, maxRoadHops);
        if (!canReach) {
          throw new Error('Target province is not reachable (not adjacent and no valid road path exists)');
        }
      }

      const toProvince = await manager.findOne(Province, {
        where: { id: toProvinceId },
        relations: ['buildings'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!toProvince) throw new Error('Target province not found');

      // ── Friendly move ────────────────────────────────────────────────────
      if (toProvince.user_id === action.userId) {
        army.province_id = toProvinceId;
        await manager.save(Army, army);
        return;
      }

      // ── Combat ───────────────────────────────────────────────────────────
      const defenderArmies = await manager.find(Army, {
        where: { province_id: toProvinceId },
        relations: ['units', 'units.troopType'],
        lock: { mode: 'pessimistic_write' },
      });
      const enemyArmies = defenderArmies.filter((a) => a.user_id !== action.userId);

      // Uncontested: no enemy armies and province is unowned or empty
      if (enemyArmies.length === 0) {
        army.province_id = toProvinceId;
        const isWater = toProvince.type?.toLowerCase() === 'water';
        if (!isWater && !toProvince.user_id) {
          toProvince.user_id = action.userId;
          await manager.save(Province, toProvince);
        }
        await manager.save(Army, army);
        return;
      }

      // Power calculations
      const attackCtx = { attackingTroops: armyAttackPower(army) };
      for (const techKey of (attacker?.completed_research ?? [])) {
        BATTLE_RESEARCH_EFFECTS[techKey]?.(attackCtx);
      }
      const attackerPower = attackCtx.attackingTroops;

      const defenderBasePower = enemyArmies.reduce(
        (sum, a) => sum + armyDefensePower(a),
        0,
      );
      const buildingModifier = computeBuildModifier(toProvince.buildings);
      const defenderPower = defenderBasePower * buildingModifier;

      if (attackerPower > defenderPower) {
        // ── Attacker wins ─────────────────────────────────────────────────
        const attackerCasualtyRate = Math.max(
          CASUALTY_FLOOR,
          defenderPower / (attackerPower + defenderPower),
        );
        applyCasualties(army, attackerCasualtyRate);

        // Destroy all defending armies
        for (const da of enemyArmies) {
          await manager.delete(ArmyUnit, { army_id: da.id });
          await manager.delete(Army, da.id);
        }

        if (armyTotalTroops(army) < ARMY_MIN_SIZE) {
          // Army took too many casualties even in victory – disband it
          this.logger.log(`Army ${army.id} fell below min size after victory – disbanding`);
          await manager.delete(ArmyUnit, { army_id: army.id });
          await manager.delete(Army, army.id);
        } else {
          const isWater = toProvince.type?.toLowerCase() === 'water';
          if (!isWater) {
            toProvince.user_id = action.userId;
            await manager.save(Province, toProvince);
          }
          army.province_id = toProvinceId;
          await manager.save(ArmyUnit, army.units);
          await manager.save(Army, army);
        }
      } else {
        // ── Defender wins ─────────────────────────────────────────────────
        // Attacker takes heavy losses and retreats to source province
        const maxAtttakerLoseRate = 0.8;
        const baseAttackerRateCoeff = 1.4;

        const attackerRate = defenderPower / (defenderPower + attackerPower) * baseAttackerRateCoeff;

        const attackerCasualtyRate = Math.min(maxAtttakerLoseRate, Math.max(CASUALTY_FLOOR, attackerRate));
        applyCasualties(army, attackerCasualtyRate);

        // Defenders take minor losses
        const baseDefenderRateCoeff = 0.7;

        const baseDefenderRate = attackerPower / (attackerPower + defenderPower) * baseDefenderRateCoeff;
        const defenderCasualtyRate = Math.max(CASUALTY_FLOOR, baseDefenderRate);

        for (const da of enemyArmies) {
          applyCasualties(da, defenderCasualtyRate);
          if (armyTotalTroops(da) < ARMY_MIN_SIZE) {
            await manager.delete(ArmyUnit, { army_id: da.id });
            await manager.delete(Army, da.id);
          } else {
            await manager.save(ArmyUnit, da.units);
            await manager.save(Army, da);
          }
        }

        if (armyTotalTroops(army) < ARMY_MIN_SIZE) {
          this.logger.log(`Army ${army.id} fell below min size after retreat – disbanding`);
          await manager.delete(ArmyUnit, { army_id: army.id });
          await manager.delete(Army, army.id);
        } else {
          // Retreat: army stays in source province
          await manager.save(ArmyUnit, army.units);
          await manager.save(Army, army);
        }
      }
    });
  }
}

@Injectable()
export class ArmyMergeHandler implements ActionHandler {
  private readonly logger = new Logger(ArmyMergeHandler.name);

  constructor(
    @InjectRepository(Army)
    private readonly armyRepo: Repository<Army>,
  ) {}

  handle = async (action: ActionQueue): Promise<void> => {
    this.logger.log(`Executing ARMY_MERGE for user ${action.userId}`);

    const sourceId = action.actionData?.source_army_id as string | undefined;
    const targetId = action.actionData?.target_army_id as string | undefined;

    if (!sourceId || !targetId) throw new Error('source_army_id and target_army_id are required');
    if (sourceId === targetId) throw new Error('source and target armies must be different');

    await this.armyRepo.manager.transaction(async (manager) => {
      const [source, target] = await Promise.all([
        manager.findOne(Army, {
          where: { id: sourceId },
          relations: ['units', 'units.troopType'],
          lock: { mode: 'pessimistic_write' },
        }),
        manager.findOne(Army, {
          where: { id: targetId },
          relations: ['units', 'units.troopType'],
          lock: { mode: 'pessimistic_write' },
        }),
      ]);

      if (!source) throw new Error('Source army not found');
      if (!target) throw new Error('Target army not found');
      if (source.user_id !== action.userId) throw new Error('User does not own source army');
      if (target.user_id !== action.userId) throw new Error('User does not own target army');
      if (source.province_id !== target.province_id) {
        throw new Error('Both armies must be in the same province to merge');
      }

      // Merge units: add source counts into matching target unit types
      for (const srcUnit of source.units) {
        const existing = target.units.find((u) => u.troop_type_id === srcUnit.troop_type_id);
        if (existing) {
          existing.count += srcUnit.count;
        } else {
          const newUnit = manager.create(ArmyUnit, {
            army_id: target.id,
            troop_type_id: srcUnit.troop_type_id,
            troopType: srcUnit.troopType,
            count: srcUnit.count,
          });
          target.units.push(newUnit);
        }
      }

      await manager.save(ArmyUnit, target.units);
      await manager.delete(ArmyUnit, { army_id: source.id });
      await manager.delete(Army, source.id);
    });
  }
}

@Injectable()
export class ArmyDisbandHandler implements ActionHandler {
  private readonly logger = new Logger(ArmyDisbandHandler.name);

  constructor(
    @InjectRepository(Army)
    private readonly armyRepo: Repository<Army>,
  ) {}

  handle = async (action: ActionQueue): Promise<void> => {
    this.logger.log(`Executing ARMY_DISBAND for user ${action.userId}`);

    const armyId = action.actionData?.army_id as string | undefined;
    if (!armyId) throw new Error('army_id is required');

    await this.armyRepo.manager.transaction(async (manager) => {
      const army = await manager.findOne(Army, {
        where: { id: armyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!army) throw new Error('Army not found');
      if (army.user_id !== action.userId) throw new Error('User does not own this army');

      await manager.delete(ArmyUnit, { army_id: armyId });
      await manager.delete(Army, armyId);
    });
  }
}

// ---------------------------------------------------------------------------
// ArmyEditHandler — removes troops of a specific type from an army
// ---------------------------------------------------------------------------

@Injectable()
export class ArmyEditHandler implements ActionHandler {
  private readonly logger = new Logger(ArmyEditHandler.name);

  constructor(
    @InjectRepository(Army)
    private readonly armyRepo: Repository<Army>,
    @InjectRepository(ArmyUnit)
    private readonly armyUnitRepo: Repository<ArmyUnit>,
  ) {}

  handle = async (action: ActionQueue): Promise<void> => {
    this.logger.log(`Executing ARMY_EDIT for user ${action.userId}`);

    const armyId = action.actionData?.army_id as string | undefined;
    const troopTypeKey = action.actionData?.troop_type_key as string | undefined;
    const removeCount = Number(action.actionData?.count);

    if (!armyId || !troopTypeKey || !Number.isFinite(removeCount) || removeCount <= 0) {
      throw new Error('army_id, troop_type_key, and count (>0) are required');
    }

    await this.armyRepo.manager.transaction(async (manager) => {
      const army = await manager.findOne(Army, {
        where: { id: armyId },
        relations: ['units', 'units.troopType'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!army) throw new Error('Army not found');
      if (army.user_id !== action.userId) throw new Error('User does not own this army');

      const unit = army.units.find((u) => u.troopType.key === troopTypeKey);
      if (!unit) throw new Error(`Troop type ${troopTypeKey} not found in army`);

      const totalAfterRemoval = armyTotalTroops(army) - removeCount;
      if (totalAfterRemoval < ARMY_MIN_SIZE) {
        throw new Error(
          `Army must contain at least ${ARMY_MIN_SIZE} troops after removal (would have ${totalAfterRemoval})`,
        );
      }

      const newCount = unit.count - removeCount;
      if (newCount <= 0) {
        await manager.delete(ArmyUnit, unit.id);
      } else {
        unit.count = newCount;
        await manager.save(ArmyUnit, unit);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// ColonizeActionHandler
// ---------------------------------------------------------------------------

@Injectable()
export class ColonizeActionHandler implements ActionHandler {
  private readonly logger = new Logger(ColonizeActionHandler.name);

  constructor(
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing COLONIZE action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    const provinceId = action.actionData?.province_id as string | undefined;
    if (!provinceId) throw new Error('province_id is required');

    const COLONIZE_COST = 500;

    await this.provinceRepo.manager.transaction(async (manager) => {
      const province = await manager.findOne(Province, {
        where: { id: provinceId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!province) throw new Error('Province not found');
      if (province.user_id !== null) throw new Error('Province is already owned');

      const user = await manager.findOne(User, {
        where: { id: action.userId },
        relations: ['provinces'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) throw new Error('User not found');
      if ((user.money ?? 0) < COLONIZE_COST) throw new Error('Not enough money to colonize (costs 500)');

      const userProvinceIds = new Set((user.provinces ?? []).map((p) => p.id));
      const isNeighbor = (province.neighbor_ids ?? []).some((nId) => userProvinceIds.has(nId));
      if (!isNeighbor) throw new Error('Target province is not adjacent to any of your provinces');

      user.money = (user.money ?? 0) - COLONIZE_COST;
      province.user_id = action.userId;

      await manager.save(User, user);
      await manager.save(Province, province);
    });
  }
}

// ---------------------------------------------------------------------------
// ActionExecutorService
// ---------------------------------------------------------------------------

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
    private removeHandler: RemoveActionHandler,
    private armyCreateHandler: ArmyCreateHandler,
    private armyRecruitHandler: ArmyRecruitHandler,
    private armyMoveHandler: ArmyMoveHandler,
    private armyMergeHandler: ArmyMergeHandler,
    private armyDisbandHandler: ArmyDisbandHandler,
    private armyEditHandler: ArmyEditHandler,
    private colonizeHandler: ColonizeActionHandler,
  ) {
    this.handlers.set(ActionType.BUILD, buildHandler);
    this.handlers.set(ActionType.INVADE, invadeHandler);
    this.handlers.set(ActionType.DEPLOY, deployHandler);
    this.handlers.set(ActionType.UPGRADE, upgradeHandler);
    this.handlers.set(ActionType.TRANSFER_TROOPS, transferTroopsHandler);
    this.handlers.set(ActionType.RESEARCH, researchHandler);
    this.handlers.set(ActionType.REMOVE, removeHandler);
    this.handlers.set(ActionType.ARMY_CREATE, armyCreateHandler);
    this.handlers.set(ActionType.ARMY_RECRUIT, armyRecruitHandler);
    this.handlers.set(ActionType.ARMY_MOVE, armyMoveHandler);
    this.handlers.set(ActionType.ARMY_MERGE, armyMergeHandler);
    this.handlers.set(ActionType.ARMY_DISBAND, armyDisbandHandler);
    this.handlers.set(ActionType.ARMY_EDIT, armyEditHandler);
    this.handlers.set(ActionType.COLONIZE, colonizeHandler);
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
