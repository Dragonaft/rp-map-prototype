import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { instanceToPlain } from 'class-transformer';
import { Repository } from 'typeorm';
import { Province } from './entities/province.entity';
import { ProvincesUpdateBodyRequest } from './requests/provinces-update-body.request';
import { User } from "../users/entities/user.entity";
import { Building } from '../buildings/entities/building.entity';
import { ProvinceBuilding } from '../buildings/entities/province-building.entity';
import { AuthTokenType } from "../auth/types/auth.types";
import { ActionsService } from '../actions/actions.service';
import { UsersService } from '../users/users.service';
import { computeBuildingCap } from '../techs/research-effects';
import { BuildingTypes } from "../buildings/types/building.types";
import { Army } from '../armies/entities/army.entity';

@Injectable()
export class ProvincesService {
  constructor(
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Army)
    private readonly armyRepository: Repository<Army>,
    private readonly actionsService: ActionsService,
    private readonly usersService: UsersService,
  ) {}

  async getAll(userId: string) {
    const [provinces, enemyArmies, reservedByFromProvince] = await Promise.all([
      this.provinceRepository.find({
        relations: ['provinceBuildings', 'provinceBuildings.building'],
      }),
      this.armyRepository
        .createQueryBuilder('a')
        .select(['a.province_id'])
        .where('a.user_id != :userId', { userId })
        .getMany(),
      this.actionsService.getReservedTroopMovesByFromProvince(userId),
    ]);

    const visibleProvinceIds = new Set<string>();
    for (const p of provinces) {
      if (p.user_id === userId) {
        visibleProvinceIds.add(p.id);
        for (const nId of p.neighbor_ids ?? []) {
          visibleProvinceIds.add(nId);
        }
      }
    }

    const provincesWithEnemyArmies = new Set(
      enemyArmies
        .filter(a => visibleProvinceIds.has(a.province_id))
        .map(a => a.province_id),
    );

    return provinces.map(province => {
      if (province.user_id !== userId) {
        province.enemyHere = provincesWithEnemyArmies.has(province.id) || false;
        province.local_troops = null;
        province.provinceBuildings = (province.provinceBuildings ?? [])
          .filter((pb) => pb.building?.visible);
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
    const [provinces, user, reserved, enemyArmies] = await Promise.all([
      this.provinceRepository
        .createQueryBuilder('p')
        .select(['p.id', 'p.user_id', 'p.local_troops', 'p.landscape', 'p.resource_type', 'p.neighbor_ids'])
        .leftJoinAndSelect('p.provinceBuildings', 'pb')
        .leftJoinAndSelect('pb.building', 'building')
        .getMany(),
      this.userRepository.findOne({ where: { id: userId } }),
      this.actionsService.getReservedTroopMovesByFromProvince(userId),
      this.armyRepository
        .createQueryBuilder('a')
        .select(['a.province_id'])
        .where('a.user_id != :userId', { userId })
        .getMany(),
    ]);

    const visibleProvinceIds = new Set<string>();
    for (const p of provinces) {
      if (p.user_id === userId) {
        visibleProvinceIds.add(p.id);
        for (const nId of p.neighbor_ids ?? []) {
          visibleProvinceIds.add(nId);
        }
      }
    }

    const provincesWithEnemyArmies = new Set(
      enemyArmies
        .filter(a => visibleProvinceIds.has(a.province_id))
        .map(a => a.province_id),
    );

    const completedResearch = user?.completed_research ?? [];

    return provinces.map(p => {
      const isOwner = p.user_id === userId;
      return {
        id: p.id,
        userId: p.user_id ?? null,
        localTroops: isOwner
          ? Math.max(0, (p.local_troops ?? 0) - (reserved.get(p.id) ?? 0))
          : null,
        enemyHere: !isOwner && provincesWithEnemyArmies.has(p.id),
        // Each entry carries its ProvinceBuilding instance id so the client can
        // uniquely key and target a specific building (multiple of the same type
        // can exist in one province). The template fields are flattened in.
        // Non-owners only see buildings marked as visible.
        buildings: (p.provinceBuildings ?? [])
          .filter((pb) => pb.building && (isOwner || pb.building.visible))
          .map((pb) => ({ ...instanceToPlain(pb.building), instanceId: pb.id })),
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
      relations: ['provinceBuildings', 'provinceBuildings.building']
    });

    const foundUser = await this.userRepository.findOne({ where: { id: user.id } });

    if (!foundUser) {
      throw new NotFoundException(`User with id ${user.id} not found`);
    }

    if (!foundUser.is_new) {
      throw new NotFoundException(`User ${user.id} already did setup`);
    }

    if (!province) {
      throw new NotFoundException(`Province with id ${id} not found`);
    }

    if (province.user_id !== null) {
      throw new Error(`Province is already occupied for user!`);
    }

    if (province.type === 'water') {
      throw new Error(`You cant start on water province!`);
    }

    // Add CAPITAL building to the province. Fail loudly if the template is
    // missing (e.g. buildings table not yet seeded after a reset) so we never
    // hand out a province without a capital.
    const building = await this.buildingRepository.findOne({ where: { type: BuildingTypes.CAPITAL } });
    if (!building) {
      throw new Error('CAPITAL building template not found — run the building seed before setup');
    }
    const pb = new ProvinceBuilding();
    pb.province_id = province.id;
    pb.building_id = building.id;
    province.provinceBuildings.push(pb);

    province.user_id = user.id;

    foundUser.is_new = false;
    foundUser.troops = 3000;
    foundUser.money = 5000;
    foundUser.research_points = 10;

    await this.userRepository.save(foundUser);
    await this.provinceRepository.save(province);

    const enrichedUser = await this.usersService.findOne(user.id, user.id);
    const newProvince = await this.provinceRepository
      .createQueryBuilder('p')
      .select(['p.id', 'p.user_id', 'p.local_troops', 'p.landscape', 'p.resource_type'])
      .leftJoinAndSelect('p.provinceBuildings', 'pb')
      .leftJoinAndSelect('pb.building', 'building')
      .where('p.id = :id', { id: province.id })
      .getOne()

    const formatProvince = {
      id: newProvince.id,
      userId: newProvince.user_id ?? null,
      buildings: newProvince.buildings,
    };

    return {
      user: enrichedUser,
      province: formatProvince,
    }
  }
}
