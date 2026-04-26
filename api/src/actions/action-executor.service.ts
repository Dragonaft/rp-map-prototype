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
const REMOVE_COST = 100;
const ARMY_MIN_SIZE = 100;
const CASUALTY_FLOOR = 0.05;

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

// ---------------------------------------------------------------------------
// Shared army helpers
// ---------------------------------------------------------------------------

/** Total troop count across all unit types in an army. */
const armyTotalTroops = (army: Army): number =>
  (army.units ?? []).reduce((sum, u) => sum + u.count, 0);

/** Offensive power of an army: Σ(count × attack). */
const armyAttackPower = (army: Army): number =>
  (army.units ?? []).reduce((sum, u) => sum + u.count * u.troopType.attack, 0);

/** Defensive power of an army: Σ(count × defense). */
const armyDefensePower = (army: Army): number =>
  (army.units ?? []).reduce((sum, u) => sum + u.count * u.troopType.defense, 0);


/**
 * Apply a casualty rate to all unit types in an army proportionally.
 * Removes unit types that reach 0.
 */
const applyCasualties = (army: Army, rate: number): void => {
  for (const unit of army.units) {
    unit.count = Math.max(0, unit.count - Math.floor(unit.count * rate));
  }
  army.units = army.units.filter((u) => u.count > 0);
};

// ---------------------------------------------------------------------------
// Army action handlers
// ---------------------------------------------------------------------------

interface RecruitEntry {
  troop_type_key: string;
  count: number;
}

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

    // Deduct cost
    // Always deduct from the draft pool
    const pool = Number(user.troops ?? 0);
    if (pool < entry.count) {
      throw new Error(
        `Not enough troops in the draft pool (have ${pool}, need ${entry.count})`,
      );
    }
    user.troops = pool - entry.count;

    // Paid unit types also cost money
    if (troopType.cost_per_100 > 0) {
      const cost = Math.ceil((entry.count / 100) * troopType.cost_per_100);
      const money = Number(user.money ?? 0);
      if (money < cost) {
        throw new Error(
          `Not enough money to recruit ${entry.count} ${troopType.name} (need ${cost}, have ${money})`,
        );
      }
      user.money = money - cost;
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

      const fromProvince = await manager.findOne(Province, { where: { id: army.province_id } });
      if (!fromProvince) throw new Error('Source province not found');

      const neighborIds: string[] = fromProvince.neighbor_ids ?? [];
      if (!neighborIds.includes(toProvinceId)) {
        throw new Error('Target province is not adjacent to the army\'s current province');
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
      const attacker = await manager.findOne(User, { where: { id: action.userId } });
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
        const baseRate = attackerPower / (attackerPower + defenderPower);
        const attackerCasualtyRate = Math.min(0.8, Math.max(CASUALTY_FLOOR, baseRate * 1.5));
        applyCasualties(army, attackerCasualtyRate);

        // Defenders take minor losses
        const defenderCasualtyRate = Math.max(CASUALTY_FLOOR, baseRate * 0.3);
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
