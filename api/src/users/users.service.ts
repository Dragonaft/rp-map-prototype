import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { instanceToPlain } from 'class-transformer';
import { createHash } from 'crypto';
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
import { computeArmyBaseFoodNeed, scaleFoodNeed, supplyMultiplierForDistance } from '../actions/supply-utils';

const BUILDING_UPKEEP_TYPES = new Set<string>([
  BuildingTypes.FORT,
  BuildingTypes.BARRACKS,
  BuildingTypes.ARMORY,
]);

/** Hard byte cap for an uploaded flag image, enforced both by Multer's `limits.fileSize`
 *  (rejects before the buffer is fully read) and again here (belt-and-braces). */
export const FLAG_MAX_BYTES = 256 * 1024;

export interface FlagResult {
  data: Buffer;
  mime: string;
  hash: string | null;
}

/** Sniffs magic bytes to derive the real image format — never trusts the client-supplied
 *  `mimetype`/filename extension, since a renamed non-image file would otherwise sail
 *  through. Rejects everything but PNG/JPEG/WebP (deliberately no SVG — a same-origin
 *  user-uploaded SVG is a stored-XSS vector). */
export const sniffImageMime = (buffer: Buffer): string | null => {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
};

/** Builds the client-facing flag URL from a stored hash — null when the user has no flag.
 *  The hash doubles as an immutable cache-busting token (see GET /users/:id/flag). */
export const buildFlagUrl = (userId: string, flagHash: string | null | undefined): string | null =>
  flagHash ? `/users/${userId}/flag?v=${flagHash}` : null;

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
    // Explicit select — `lore` (mediumtext) has no `select: false` at the column level, since
    // the owner's single-user GET /users/:id needs it included for free (see UsersController's
    // getLore doc comment). Without narrowing here, this bulk list (fetched once per player on
    // every load, backing the otherUsers slice) would drag every player's full lore text
    // through the DB round-trip even though the mapped response below never uses it.
    const users = await this.usersRepository.find({ select: ['id', 'country_name', 'color', 'flag_hash'] });
    return users.map(user => ({
      id: user.id,
      countryName: user.country_name,
      color: user.color,
      flagUrl: buildFlagUrl(user.id, user.flag_hash),
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
        flagUrl: buildFlagUrl(user.id, user.flag_hash),
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

    // ---- Food projection ----
    // Production mirrors the seed data's CAPITAL/FARM/GARDEN production_amount (the only
    // buildings currently seeded to produce Food) rather than resolving Good-by-name, matching
    // this method's existing style of special-casing FARM/GARDEN/CAPITAL by BuildingTypes above.
    // Consumption reads each army's *stored* supply_distance (written each turn by
    // SupplyActionService) through the same shared cost formula it uses, so this projection can
    // never drift from what the next turn will actually charge.
    let foodProduction = 0;
    for (const p of provinces) {
      for (const b of p.buildings ?? []) {
        if (b.type === BuildingTypes.CAPITAL || b.type === BuildingTypes.FARM || b.type === BuildingTypes.GARDEN) {
          foodProduction += Number(b.production_amount) || 0;
        }
      }
    }

    let foodConsumption = 0;
    for (const army of armies) {
      const multiplier = supplyMultiplierForDistance(army.supply_distance ?? null);
      const need = scaleFoodNeed(computeArmyBaseFoodNeed(army), multiplier);
      for (const amount of need.values()) foodConsumption += amount;
    }

    const projectedFood = foodProduction - foodConsumption;

    return {
      ...instanceToPlain(user),
      flagUrl: buildFlagUrl(user.id, user.flag_hash),
      projectedIncome: incomeTotal - totalUpkeep,
      projectedTroops: barracksCount * 50,
      projectedResearch,
      projectedPiety,
      projectedFood,
    };
  }

  async update(id: string, updateUserDto: UsersUpdateBodyRequest, callerId: string): Promise<{ countryName: string, color: string, lore?: string }> {
    const user = await this.findOneEntity(id);

    // TODO: Maybe move this logic to guards or something
    if (callerId !== id) {
      // ForbiddenException (not a plain Error) so this 403s cleanly instead of bubbling up as
      // an unhandled 500 — matches the convention setFlag/deleteFlag already use below.
      throw new ForbiddenException('User id does not match caller id');
    }

    await this.assertCountryIdentityAvailable(updateUserDto.country_name, updateUserDto.color, id);

    Object.assign(user, updateUserDto);

    await this.usersRepository.save(user)

    return {
      countryName: updateUserDto.country_name,
      color: updateUserDto.color,
      lore: updateUserDto.lore,
    };
  }

  /** Validates and stores an uploaded flag image. Uses a partial `update()` rather than
   *  loading+saving the full entity — the flag byte buffer has no business round-tripping
   *  through the province/army relations `findOneEntity` would otherwise pull in. */
  async setFlag(id: string, callerId: string, file: Buffer | undefined): Promise<{ flagUrl: string }> {
    if (callerId !== id) {
      throw new ForbiddenException('User id does not match caller id');
    }
    if (!file || file.length === 0) {
      throw new BadRequestException('No flag file uploaded');
    }
    if (file.length > FLAG_MAX_BYTES) {
      throw new BadRequestException(`Flag image must be ${FLAG_MAX_BYTES / 1024}KB or smaller`);
    }

    const mime = sniffImageMime(file);
    if (!mime) {
      throw new BadRequestException('Flag must be a PNG, JPEG, or WebP image');
    }

    const flag_hash = createHash('sha256').update(file).digest('hex');
    const result = await this.usersRepository.update(id, { flag_data: file, flag_mime: mime, flag_hash });
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return { flagUrl: buildFlagUrl(id, flag_hash) };
  }

  async deleteFlag(id: string, callerId: string): Promise<void> {
    if (callerId !== id) {
      throw new ForbiddenException('User id does not match caller id');
    }
    await this.clearFlag(id);
  }

  /** No ownership check — for the admin/moderator takedown path (POST /admin/users/:id/flag). */
  async adminDeleteFlag(id: string): Promise<void> {
    await this.clearFlag(id);
  }

  private async clearFlag(id: string): Promise<void> {
    const result = await this.usersRepository.update(id, { flag_data: null, flag_mime: null, flag_hash: null });
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  /** Explicitly re-selects `flag_data` (excluded from ordinary reads via `select: false` on
   *  the column) for GET /users/:id/flag. Null when the user has no flag or doesn't exist. */
  async getFlag(id: string): Promise<FlagResult | null> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'flag_data', 'flag_mime', 'flag_hash'],
    });
    if (!user?.flag_data || !user.flag_mime) {
      return null;
    }
    return { data: user.flag_data, mime: user.flag_mime, hash: user.flag_hash };
  }

  /** Light single-field read for GET /users/:id/lore — deliberately not `findOneEntity`,
   *  which eagerly loads provinces/buildings that a lore fetch has no use for. Public: any
   *  authenticated player may view any other's lore, same as GET /diplomacy/treaties/public/:userId. */
  async getLore(id: string): Promise<{ lore: string | null }> {
    const user = await this.usersRepository.findOne({ where: { id }, select: ['id', 'lore'] });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return { lore: user.lore };
  }

  async remove(id: string): Promise<void> {
    // const user = await this.findOne(id);
    // await this.usersRepository.remove(user);
  }
}
