import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { instanceToPlain } from 'class-transformer';
import { User } from './entities/user.entity';
import { UsersCreateBodyRequest } from "./requests/users-create-body.request";
import { UsersUpdateBodyRequest } from "./requests/users-update-body.request";
import { PartialUser, UserClasses, UserRoles } from "./types/users.types";
import { BuildingTypes } from '../buildings/types/building.types';
import { Army } from '../armies/entities/army.entity';
import { parseIncome } from '../utils/parseIncome';
import {
  INCOME_RESEARCH_EFFECTS,
  UPKEEP_RESEARCH_EFFECTS,
  RESEARCH_POINT_EFFECTS,
} from '../techs/research-effects';

const MINE_INCOME_BY_RESOURCE: Record<string, number> = {
  stone: 75,
  iron: 125,
  gold: 300,
};

const BUILDING_UPKEEP_TYPES = new Set<string>([
  BuildingTypes.FORT,
  BuildingTypes.BARRACKS,
  BuildingTypes.ARMORY,
]);

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Army)
    private readonly armyRepository: Repository<Army>,
  ) {}

  async create(createUserDto: UsersCreateBodyRequest): Promise<User> {
    const count = await this.usersRepository.count();
    const role = count === 0 ? UserRoles.ADMIN : UserRoles.PLAYER;

    const user = this.usersRepository.create({
      ...createUserDto,
      is_new: true,
      role,
    });

    return await this.usersRepository.save(user);
  }

  async findAll(): Promise<PartialUser[]> {
    const users = await this.usersRepository.find();
    return users.map(user => ({
      id: user.id,
      countryName: user.country_name,
      color: user.color,
    }));
  }

  private async findOneEntity(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['provinces', 'provinces.buildings'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findOne(id: string, callerId: string) {
    const user = await this.findOneEntity(id);

    if (callerId !== id) {
      return {
        id: user.id,
        countryName: user.country_name,
        color: user.color,
      };
    }

    const armies = await this.armyRepository.find({
      where: { user_id: id },
      relations: ['units', 'units.troopType'],
    });

    const completedResearch = user.completed_research ?? [];
    const provinces = user.provinces ?? [];

    // ---- Resources ----
    const resources = { stone: 0, iron: 0, gold: 0, wood: 0 };

    // ---- Income projection (mirrors IncomeActionService) ----
    let incomeTotal = 0;
    let barracksCount = 0;
    let farmGardenIncome = 0;
    const capitalCount = 1; // mirrors hardcoded value in IncomeActionService

    for (const p of provinces) {
      for (const b of p.buildings ?? []) {
        switch (b.type) {
          case BuildingTypes.MINE:
            incomeTotal += MINE_INCOME_BY_RESOURCE[p.resource_type] ?? 0;
            switch (p.resource_type) {
              case 'stone': resources.stone++; break;
              case 'iron':  resources.iron++;  break;
              case 'gold':  resources.gold++;  break;
            }
            break;
          case BuildingTypes.FORESTRY:
            incomeTotal += parseIncome(b.income);
            resources.wood++;
            break;
          case BuildingTypes.BARRACKS:
            barracksCount++;
            break;
          case BuildingTypes.CAPITAL:
            barracksCount++;
            incomeTotal += parseIncome(b.income);
            break;
          case BuildingTypes.FARM:
          case BuildingTypes.GARDEN:
            farmGardenIncome += parseIncome(b.income);
            incomeTotal += parseIncome(b.income);
            break;
          default:
            incomeTotal += parseIncome(b.income);
        }
      }
    }

    const incomeCtx = { incomeTotal, barracksCount, farmGardenIncome, provinceCount: provinces.length, capitalCount };
    for (const techKey of completedResearch) {
      INCOME_RESEARCH_EFFECTS[techKey]?.(incomeCtx);
    }
    incomeTotal = incomeCtx.incomeTotal;

    // ---- Upkeep projection (mirrors UpkeepActionService) ----
    let buildingUpkeep = 0;
    for (const p of provinces) {
      for (const b of p.buildings ?? []) {
        if (BUILDING_UPKEEP_TYPES.has(b.type)) {
          buildingUpkeep += Number(b.upkeep) || 0;
        }
      }
    }

    let armyUpkeep = 0;
    for (const army of armies) {
      armyUpkeep += army.flat_upkeep;
      for (const unit of army.units ?? []) {
        const upkeepPer100 = unit.troopType?.upkeep_per_100 ?? 0;
        armyUpkeep += Math.ceil(Math.max(0, unit.count) / 100) * upkeepPer100;
      }
    }

    const upkeepCtx = { totalUpkeep: buildingUpkeep + armyUpkeep };
    for (const techKey of completedResearch) {
      UPKEEP_RESEARCH_EFFECTS[techKey]?.(upkeepCtx);
    }

    // ---- Research projection (mirrors IncomeActionService) ----
    let researchTotal = 0;
    for (const p of provinces) {
      for (const b of p.buildings ?? []) {
        if (b.type === BuildingTypes.CAPITAL) researchTotal++;
        if (b.type === BuildingTypes.LIBRARY)  researchTotal++;
      }
    }
    const rpCtx = { researchTotal, capitalCount };
    for (const techKey of completedResearch) {
      RESEARCH_POINT_EFFECTS[techKey]?.(rpCtx);
    }

    // ---- Piety projection (HOLY class only) ----
    let projectedPiety: number | null = null;
    if (user.class === UserClasses.HOLY) {
      let pietyCount = 0;
      for (const p of provinces) {
        for (const b of p.buildings ?? []) {
          if (b.type === BuildingTypes.TEMPLE)    pietyCount += 1;
          if (b.type === BuildingTypes.CATHEDRAL) pietyCount += 2;
        }
      }
      const pietyIncome = pietyCount * 10;

      let paladinUpkeep = 0;
      for (const army of armies) {
        for (const unit of army.units ?? []) {
          if (unit.troopType?.key === 'paladins') {
            paladinUpkeep += Math.ceil(Math.max(0, unit.count) / 100) * (unit.troopType.upkeep_per_100 ?? 0);
          }
        }
      }

      projectedPiety = pietyIncome - paladinUpkeep;
    }

    return {
      ...instanceToPlain(user),
      resources,
      projectedIncome: incomeTotal - upkeepCtx.totalUpkeep,
      projectedTroops: barracksCount * 50,
      projectedResearch: rpCtx.researchTotal,
      projectedPiety,
    };
  }

  async update(id: string, updateUserDto: UsersUpdateBodyRequest): Promise<User> {
    const user = await this.findOneEntity(id);

    Object.assign(user, updateUserDto);

    return await this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    // const user = await this.findOne(id);
    // await this.usersRepository.remove(user);
  }
}
