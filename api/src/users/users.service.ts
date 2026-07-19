import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { instanceToPlain } from 'class-transformer';
import { User } from './entities/user.entity';
import { UsersCreateBodyRequest } from "./requests/users-create-body.request";
import { UsersUpdateBodyRequest } from "./requests/users-update-body.request";
import { PartialUser, UserClasses, UserRoles } from "./types/users.types";
import { BuildingTypes } from '../buildings/types/building.types';
import { Army } from '../armies/entities/army.entity';
import { UserGoodsService } from '../goods/user-goods.service';
import { UserResourcesService } from '../resources/user-resources.service';
import { parseIncome } from '../utils/parseIncome';
import { TechEffectsService } from '../techs/tech-effects.service';
import { colorsTooSimilar } from '../utils/colorDistance';

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
    private readonly userGoodsService: UserGoodsService,
    private readonly userResourcesService: UserResourcesService,
    private readonly techEffects: TechEffectsService,
  ) {}

  async assertCountryIdentityAvailable(
    countryName: string | undefined, color: string | undefined, excludeUserId?: string,
  ): Promise<void> {
    if (countryName) {
      const existing = await this.usersRepository.findOne({ where: { country_name: countryName } });
      if (existing && existing.id !== excludeUserId) {
        throw new ConflictException(`Country name "${countryName}" is already taken`);
      }
    }

    if (color) {
      const others = await this.usersRepository.find({ select: ['id', 'color'] });
      for (const other of others) {
        if (other.id === excludeUserId || !other.color) continue;
        if (colorsTooSimilar(color, other.color)) {
          throw new ConflictException(
            `Color ${color} is too close to another country's color (${other.color}) to tell apart on the map`,
          );
        }
      }
    }
  }

  async create(createUserDto: UsersCreateBodyRequest): Promise<User> {
    await this.assertCountryIdentityAvailable(createUserDto.country_name, createUserDto.color);

    const count = await this.usersRepository.count();
    const role = count === 0 ? UserRoles.ADMIN : UserRoles.PLAYER;

    const user = this.usersRepository.create({
      ...createUserDto,
      is_new: true,
      role,
    });

    const saved = await this.usersRepository.save(user);
    await this.userGoodsService.createRowsForNewUser(saved);
    await this.userResourcesService.createRowsForNewUser(saved);
    return saved;
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
      relations: ['provinces', 'provinces.provinceBuildings', 'provinces.provinceBuildings.building'],
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

    // ---- Income projection (mirrors IncomeActionService) ----
    let incomeTotal = 0;
    let barracksCount = 0;
    let farmGardenIncome = 0;
    const capitalCount = 1; // mirrors hardcoded value in IncomeActionService

    for (const p of provinces) {
      for (const b of p.buildings ?? []) {
        switch (b.type) {
          case BuildingTypes.MINE:
            incomeTotal += parseIncome(b.income);
            break;
          case BuildingTypes.FORESTRY:
            incomeTotal += parseIncome(b.income);
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
    incomeTotal = this.techEffects.apply('income', incomeTotal, incomeCtx, completedResearch);

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

    const totalUpkeep = this.techEffects.apply('upkeep', buildingUpkeep + armyUpkeep, {}, completedResearch);

    // ---- Research projection (mirrors IncomeActionService) ----
    let researchTotal = 0;
    for (const p of provinces) {
      for (const b of p.buildings ?? []) {
        if (b.type === BuildingTypes.CAPITAL) researchTotal++;
        if (b.type === BuildingTypes.LIBRARY)  researchTotal++;
      }
    }
    const rpCtx = { researchTotal, capitalCount };
    const projectedResearch = this.techEffects.apply('research_points', researchTotal, rpCtx, completedResearch);

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
      projectedIncome: incomeTotal - totalUpkeep,
      projectedTroops: barracksCount * 50,
      projectedResearch,
      projectedPiety,
    };
  }

  async update(id: string, updateUserDto: UsersUpdateBodyRequest, callerId: string): Promise<{ countryName: string, color: string }> {
    const user = await this.findOneEntity(id);

    // TODO: Maybe move this logic to guards or something
    if (callerId !== id) {
      throw new Error('User id dont match caller id');
    }

    await this.assertCountryIdentityAvailable(updateUserDto.country_name, updateUserDto.color, id);

    Object.assign(user, updateUserDto);

    await this.usersRepository.save(user)

    return {
      countryName: updateUserDto.country_name,
      color: updateUserDto.color
    };
  }

  async remove(id: string): Promise<void> {
    // const user = await this.findOne(id);
    // await this.usersRepository.remove(user);
  }
}
