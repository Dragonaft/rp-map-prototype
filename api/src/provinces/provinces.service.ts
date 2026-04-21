import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Province } from './entities/province.entity';
import { ProvincesUpdateBodyRequest } from './requests/provinces-update-body.request';
import { User } from "../users/entities/user.entity";
import { Building } from '../buildings/entities/building.entity';
import { AuthTokenType } from "../auth/types/auth.types";
import { ActionsService } from '../actions/actions.service';
import { computeBuildingCap } from '../techs/research-effects';
import { BuildingTypes } from "../buildings/types/building.types";

@Injectable()
export class ProvincesService {
  constructor(
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly actionsService: ActionsService,
  ) {}

  async getAll(userId: string) {
    const provinces = await this.provinceRepository.find({
      relations: ['buildings']
    });

    const reservedByFromProvince =
      await this.actionsService.getReservedTroopMovesByFromProvince(userId);

    return provinces.map(province => {
      if (province.user_id !== userId) {
        if (province.local_troops > 0) {
          province.enemyHere = true;
        }
        province.local_troops = null;
        return province;
      }

      const reserved = reservedByFromProvince.get(province.id) ?? 0;
      if (reserved > 0 && province.local_troops != null) {
        province.local_troops = Math.max(0, province.local_troops - reserved);
      }

      return province;
    });
  }

  /** Static province data: polygon, type, landscape — never changes after map import. */
  async getLayout() {
    const provinces = await this.provinceRepository
      .createQueryBuilder('p')
      .select(['p.id', 'p.polygon', 'p.type', 'p.landscape', 'p.resource_type', 'p.region_id', 'p.neighbor_ids'])
      .getMany();

    return provinces.map(p => ({
      id: p.id,
      polygon: p.polygon,
      type: p.type,
      landscape: p.landscape,
      resourceType: p.resource_type,
      regionId: p.region_id,
      neighbors: p.neighbor_ids,
    }));
  }

  /** Dynamic province state: ownership, troops, buildings — changes only at turn end. */
  async getState(userId: string) {
    const [provinces, user, reserved] = await Promise.all([
      this.provinceRepository
        .createQueryBuilder('p')
        .select(['p.id', 'p.user_id', 'p.local_troops', 'p.landscape', 'p.resource_type'])
        .leftJoinAndSelect('p.buildings', 'building')
        .getMany(),
      this.userRepository.findOne({ where: { id: userId } }),
      this.actionsService.getReservedTroopMovesByFromProvince(userId),
    ]);

    const completedResearch = user?.completed_research ?? [];

    return provinces.map(p => {
      const isOwner = p.user_id === userId;
      return {
        id: p.id,
        userId: p.user_id ?? null,
        localTroops: isOwner
          ? Math.max(0, (p.local_troops ?? 0) - (reserved.get(p.id) ?? 0))
          : null,
        enemyHere: !isOwner && (p.local_troops ?? 0) > 0,
        buildings: p.buildings ?? [],
        buildingCap: computeBuildingCap(p.landscape, completedResearch),
      };
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} province`;
  }

  async update(id: string, updateData: ProvincesUpdateBodyRequest) {
    const province = await this.provinceRepository.findOne({ where: { id } });

    if (!province) {
      throw new NotFoundException(`Province with id ${id} not found`);
    }

    Object.assign(province, updateData);

    return await this.provinceRepository.save(province);
  }

  async setupStart(id: string, user: AuthTokenType) {
    const province = await this.provinceRepository.findOne({
      where: { id },
      relations: ['buildings']
    });

    const foundUser = await this.userRepository.findOne({ where: { id: user.id } });

    if (!foundUser) {
      throw new NotFoundException(`User with id ${user.id} not found`);
    }

    if (!province) {
      throw new NotFoundException(`Province with id ${id} not found`);
    }

    if (province.user_id !== null) {
      throw new Error(`Province is already occupied for user!`);
    }

    // Example: Add a building by id to the province
    const building = await this.buildingRepository.findOne({ where: { type: BuildingTypes.CAPITAL } });
    if (building) {
      if (!province.buildings) {
        province.buildings = [];
      }
      province.buildings.push(building);
    }

    const updatedProvince = {
      ...province,
      local_troops: 1000,
      user_id: user.id
    };

    Object.assign(province, updatedProvince);

    const updatedUser = {
      ...foundUser,
      is_new: false,
      troops: 3000,
      money: 5000,
      provinces: [province]
    }

    await this.userRepository.save(updatedUser);
    await this.provinceRepository.save(province);

    return {
      user: updatedUser,
      province: province,
    }
  }
}
