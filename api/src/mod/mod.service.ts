import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UserRoles } from '../users/types/users.types';
import { Province } from '../provinces/entities/province.entity';
import { Building } from '../buildings/entities/building.entity';
import { ProvinceBuilding } from '../buildings/entities/province-building.entity';
import { Army } from '../armies/entities/army.entity';
import { ArmyUnit } from '../armies/entities/army-unit.entity';
import { TroopType } from '../armies/entities/troop-type.entity';
import { ARMY_MIN_SIZE } from '../actions/combat-calculator';
import { OccupationService } from '../diplomacy/occupation.service';
import { UserGoodsService } from '../goods/user-goods.service';
import { UserResourcesService } from '../resources/user-resources.service';
import { UserGood } from '../goods/entities/user-good.entity';
import { UserResource } from '../resources/entities/user-resource.entity';
import { Resource } from '../resources/entities/resource.entity';

interface SpawnArmyUnitDto {
  troop_type_key: string;
  count: number;
}

interface SetStocksDto {
  money?: number;
  troops?: number;
  piety?: number;
  goods?: { goodId: string; quantity: number }[];
  resources?: { resourceKey: string; quantity: number }[];
}

/**
 * God-mode tools for the MOD-switch-ON layer: instant, free, no-turn-wait mutations for
 * ADMIN/MODERATOR running a "dungeon master" scenario — create NPC countries, hand-place
 * ownership/armies/buildings, and set a country's stockpiles directly. None of this goes
 * through the normal cost/validation path (see action-executor.service.ts for that); it's
 * the deliberate instant counterpart to the queued player-action flow.
 */
@Injectable()
export class ModService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Province) private readonly provinceRepo: Repository<Province>,
    @InjectRepository(Building) private readonly buildingRepo: Repository<Building>,
    @InjectRepository(Army) private readonly armyRepo: Repository<Army>,
    @InjectRepository(TroopType) private readonly troopTypeRepo: Repository<TroopType>,
    private readonly occupationService: OccupationService,
    private readonly userGoodsService: UserGoodsService,
    private readonly userResourcesService: UserResourcesService,
  ) {}

  // --- NPC countries ---

  async createNpc(dto: { login: string; country_name: string; color: string; money?: number; troops?: number; piety?: number }) {
    if (!dto.login?.trim()) throw new BadRequestException('login is required');
    const existing = await this.userRepo.findOne({ where: { login: dto.login } });
    if (existing) throw new BadRequestException(`login "${dto.login}" is already taken`);

    // NPCs never log in, so the password just needs to be unguessable, not memorable.
    const randomPassword = crypto.randomBytes(24).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const user = this.userRepo.create({
      login: dto.login,
      password: hashedPassword,
      country_name: dto.country_name,
      color: dto.color,
      money: dto.money ?? 0,
      troops: dto.troops ?? 0,
      piety: dto.piety ?? 0,
      role: UserRoles.PLAYER,
      is_npc: true,
      is_new: true,
    });
    const saved = await this.userRepo.save(user);
    await this.userGoodsService.createRowsForNewUser(saved);
    await this.userResourcesService.createRowsForNewUser(saved);

    const { password: _p, ...result } = saved as any;
    return result;
  }

  async listNpcs() {
    const npcs = await this.userRepo.find({ where: { is_npc: true } });
    return npcs.map(({ password: _p, ...rest }) => rest);
  }

  // --- Instant province ownership ---

  async setProvinceOwner(provinceId: string, userId: string | null) {
    return this.provinceRepo.manager.transaction(async (manager) => {
      const province = await manager.findOne(Province, {
        where: { id: provinceId },
        relations: ['provinceBuildings', 'provinceBuildings.building'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!province) throw new NotFoundException('Province not found');
      if (province.type === 'water') throw new BadRequestException('Water provinces cannot be owned');

      if (userId) {
        const user = await manager.findOne(User, { where: { id: userId } });
        if (!user) throw new NotFoundException('Target user not found');
        await this.occupationService.coreProvince(manager, province, userId);
      } else {
        province.user_id = null;
        province.occupier_id = null;
        province.occupation_turns = 0;
        province.local_troops = 0;
        await manager.save(Province, province);
      }

      return manager.findOne(Province, { where: { id: provinceId } });
    });
  }

  // --- Instant army spawn ---

  async spawnArmy(dto: { userId: string; provinceId: string; name?: string; units: SpawnArmyUnitDto[] }) {
    if (!dto.units?.length) throw new BadRequestException('units array must not be empty');

    return this.armyRepo.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: dto.userId } });
      if (!user) throw new NotFoundException('Target user not found');
      const province = await manager.findOne(Province, { where: { id: dto.provinceId } });
      if (!province) throw new NotFoundException('Province not found');

      const army = manager.create(Army, {
        name: dto.name ?? null,
        user_id: dto.userId,
        province_id: dto.provinceId,
        flat_upkeep: 100,
      });
      const savedArmy = await manager.save(Army, army);

      let total = 0;
      const units: ArmyUnit[] = [];
      for (const entry of dto.units) {
        if (!entry.troop_type_key || !Number.isInteger(entry.count) || entry.count <= 0) {
          throw new BadRequestException('Each unit needs a troop_type_key and a positive integer count');
        }
        const troopType = await manager.findOne(TroopType, { where: { key: entry.troop_type_key } });
        if (!troopType) throw new NotFoundException(`Unknown troop type: ${entry.troop_type_key}`);
        units.push(manager.create(ArmyUnit, {
          army_id: savedArmy.id,
          troop_type_id: troopType.id,
          count: entry.count,
        }));
        total += entry.count;
      }
      if (total < ARMY_MIN_SIZE) {
        throw new BadRequestException(`Army must contain at least ${ARMY_MIN_SIZE} troops (currently ${total})`);
      }

      await manager.save(ArmyUnit, units);
      return manager.findOne(Army, { where: { id: savedArmy.id }, relations: ['units', 'units.troopType'] });
    });
  }

  // --- Instant building placement ---

  async placeBuilding(provinceId: string, buildingId: string) {
    const province = await this.provinceRepo.findOne({ where: { id: provinceId } });
    if (!province) throw new NotFoundException('Province not found');
    const building = await this.buildingRepo.findOne({ where: { id: buildingId } });
    if (!building) throw new NotFoundException('Building not found');

    const pb = this.provinceRepo.manager.create(ProvinceBuilding, { province_id: provinceId, building_id: buildingId });
    return this.provinceRepo.manager.save(ProvinceBuilding, pb);
  }

  /** Instant removal — identified by the ProvinceBuilding instance id, not the building template id. */
  async removeBuilding(provinceBuildingId: string) {
    const pb = await this.provinceRepo.manager.findOne(ProvinceBuilding, { where: { id: provinceBuildingId } });
    if (!pb) throw new NotFoundException('Province building not found');
    await this.provinceRepo.manager.remove(ProvinceBuilding, pb);
  }

  // --- Instant stockpile edits (money/troops/piety/goods/resources) — may target ANY country ---

  async setStocks(userId: string, dto: SetStocksDto) {
    return this.userRepo.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new NotFoundException('User not found');

      if (dto.money !== undefined) user.money = dto.money;
      if (dto.troops !== undefined) user.troops = dto.troops;
      if (dto.piety !== undefined) user.piety = dto.piety;
      await manager.save(User, user);

      for (const { goodId, quantity } of dto.goods ?? []) {
        const row = await manager.findOne(UserGood, { where: { user_id: userId, good_id: goodId } });
        const current = row?.quantity ?? 0;
        await this.userGoodsService.adjustQuantity(manager, userId, goodId, quantity - current);
      }
      for (const { resourceKey, quantity } of dto.resources ?? []) {
        const resource = await manager.findOne(Resource, { where: { key: resourceKey } });
        const row = resource
          ? await manager.findOne(UserResource, { where: { user_id: userId, resource_id: resource.id } })
          : null;
        const current = row?.quantity ?? 0;
        await this.userResourcesService.adjustQuantity(manager, userId, resourceKey, quantity - current);
      }

      const { password: _p, ...result } = user as any;
      return result;
    });
  }
}
