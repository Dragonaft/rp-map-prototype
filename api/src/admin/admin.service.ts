import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UserRoles } from '../users/types/users.types';
import { Building } from '../buildings/entities/building.entity';
import { Army } from '../armies/entities/army.entity';
import { Tech } from '../techs/entities/tech.entity';
import { TechEffectsService } from '../techs/tech-effects.service';
import { validateEffects } from '../techs/effect-types';
import { TroopType } from '../armies/entities/troop-type.entity';
import { Resource } from '../resources/entities/resource.entity';
import { Good } from '../goods/entities/good.entity';
import { UserGoodsService } from '../goods/user-goods.service';
import { UserResourcesService } from '../resources/user-resources.service';
import { DiplomaticRelation } from '../diplomacy/entities/diplomatic-relation.entity';
import { War } from '../diplomacy/entities/war.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationSeverity } from '../notifications/entities/notification.entity';
import { NewsAgency } from '../news/entities/news-agency.entity';
import { NewsArticle } from '../news/entities/news-article.entity';
import { Province } from '../provinces/entities/province.entity';
import { ProvinceBuilding } from '../buildings/entities/province-building.entity';
import { UsersService } from '../users/users.service';
import { PlayerClass } from '../classes/entities/player-class.entity';
import { GameSettingsService } from '../settings/game-settings.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly usersService: UsersService,
    @InjectRepository(Building) private readonly buildingRepo: Repository<Building>,
    @InjectRepository(Army) private readonly armyRepo: Repository<Army>,
    @InjectRepository(Tech) private readonly techRepo: Repository<Tech>,
    @InjectRepository(TroopType) private readonly troopTypeRepo: Repository<TroopType>,
    @InjectRepository(Resource) private readonly resourceRepo: Repository<Resource>,
    @InjectRepository(Good) private readonly goodRepo: Repository<Good>,
    @InjectRepository(DiplomaticRelation) private readonly diplomaticRelationRepo: Repository<DiplomaticRelation>,
    @InjectRepository(War) private readonly warRepo: Repository<War>,
    @InjectRepository(NewsAgency) private readonly newsAgencyRepo: Repository<NewsAgency>,
    @InjectRepository(NewsArticle) private readonly newsArticleRepo: Repository<NewsArticle>,
    @InjectRepository(PlayerClass) private readonly classRepo: Repository<PlayerClass>,
    private readonly userGoodsService: UserGoodsService,
    private readonly userResourcesService: UserResourcesService,
    private readonly notificationsService: NotificationsService,
    private readonly techEffectsService: TechEffectsService,
    private readonly gameSettingsService: GameSettingsService,
  ) {}

  // --- Notifications ---

  async broadcastNotification(title: string, message: string, severity?: NotificationSeverity) {
    if (!title?.trim() || !message?.trim()) {
      throw new BadRequestException('title and message are required');
    }
    const sentTo = await this.notificationsService.broadcastToAll(title.trim(), message.trim(), severity);
    return { sentTo };
  }

  // --- Users ---

  async findAllUsers() {
    const users = await this.userRepo.find();
    return users.map(({ password: _, ...rest }) => rest);
  }

  async createUser(dto: Record<string, any>, actorRole?: UserRoles) {
    const { password, ...rest } = dto;
    // Only an ADMIN may hand out ADMIN/MODERATOR on creation too — otherwise a MODERATOR could
    // mint themselves a fellow admin via a raw request even though the panel UI hides the field.
    if (actorRole !== UserRoles.ADMIN) {
      rest.role = UserRoles.PLAYER;
    }
    await this.usersService.assertCountryIdentityAvailable(rest.country_name, rest.color);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({ ...rest, password: hashedPassword, is_new: rest.is_new ?? true });
    const saved = await this.userRepo.save(user);
    await this.userGoodsService.createRowsForNewUser(saved);
    await this.userResourcesService.createRowsForNewUser(saved);
    const { password: _, ...result } = saved as any;
    return result;
  }

  async updateUser(id: string, dto: Record<string, any>, actorRole?: UserRoles) {
    const { password: _, provinces: __, ...safeDto } = dto;
    // Only an ADMIN may reassign roles or flip is_npc — a MODERATOR editing a user's other
    // fields keeps both untouched. NPC creation for moderators goes through POST /mod/npc
    // instead, which always sets is_npc itself.
    if (actorRole !== UserRoles.ADMIN) {
      delete safeDto.role;
      delete safeDto.is_npc;
    }
    await this.usersService.assertCountryIdentityAvailable(safeDto.country_name, safeDto.color, id);
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    Object.assign(user, safeDto);
    const saved = await this.userRepo.save(user);
    const { password: _p, ...result } = saved as any;
    return result;
  }

  /**
   * Deletes a user (real player or NPC) and everything that would otherwise be orphaned or
   * left dangling. Armies, resource/goods/tech-progress ledgers, notifications, news
   * agencies/articles, diplomatic relations, wars (as leader), war participation, and treaties
   * (as proposer/receiver) all cascade automatically at the DB level via ON DELETE CASCADE
   * foreign keys on their respective entities. Provinces are the one relation with no cascade
   * (a deleted user's territory must NOT vanish) — they're explicitly unclaimed here, and their
   * buildings demolished, before the user row itself is removed.
   */
  async deleteUser(id: string, actorRole?: UserRoles) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (
      actorRole !== UserRoles.ADMIN &&
      (user.role === UserRoles.ADMIN || user.role === UserRoles.MODERATOR)
    ) {
      throw new ForbiddenException('Only an ADMIN can delete an ADMIN or MODERATOR account');
    }

    await this.userRepo.manager.transaction(async (manager) => {
      const ownedProvinces = await manager.find(Province, { where: { user_id: id } });
      const ownedProvinceIds = ownedProvinces.map((p) => p.id);
      if (ownedProvinceIds.length) {
        await manager.delete(ProvinceBuilding, { province_id: In(ownedProvinceIds) });
      }
      // Unclaim: tile goes back to a blank, freshly claimable slate (mirrors seed-test-countries.ts's reset).
      await manager.update(Province, { user_id: id }, { user_id: null });
      await manager.update(Province, { occupier_id: id }, { occupier_id: null, occupation_turns: 0 });

      await manager.remove(user);
    });
  }

  deleteUserFlag(id: string) {
    return this.usersService.adminDeleteFlag(id);
  }

  // --- Buildings ---

  findAllBuildings() {
    return this.buildingRepo.find();
  }

  async createBuilding(dto: Record<string, any>) {
    const { provinces: _, ...rest } = dto;
    const building = this.buildingRepo.create(rest);
    return this.buildingRepo.save(building);
  }

  async updateBuilding(id: string, dto: Record<string, any>) {
    const { provinces: _, ...safeDto } = dto;
    const building = await this.buildingRepo.findOne({ where: { id } });
    if (!building) throw new NotFoundException(`Building ${id} not found`);
    Object.assign(building, safeDto);
    return this.buildingRepo.save(building);
  }

  async deleteBuilding(id: string) {
    const building = await this.buildingRepo.findOne({ where: { id } });
    if (!building) throw new NotFoundException(`Building ${id} not found`);
    await this.buildingRepo.remove(building);
  }

  // --- Armies ---

  findAllArmies() {
    return this.armyRepo.find({ relations: ['units', 'units.troopType'] });
  }

  async createArmy(dto: Record<string, any>) {
    const { units: _, user: __, province: ___, ...rest } = dto;
    const army = this.armyRepo.create(rest);
    return this.armyRepo.save(army);
  }

  async updateArmy(id: string, dto: Record<string, any>) {
    const { units: _, user: __, province: ___, createdAt: ____, ...scalars } = dto;
    const army = await this.armyRepo.findOne({ where: { id }, relations: ['units', 'units.troopType'] });
    if (!army) throw new NotFoundException(`Army ${id} not found`);
    Object.assign(army, scalars);
    return this.armyRepo.save(army);
  }

  async deleteArmy(id: string) {
    const army = await this.armyRepo.findOne({ where: { id } });
    if (!army) throw new NotFoundException(`Army ${id} not found`);
    await this.armyRepo.remove(army);
  }

  // --- Techs ---

  findAllTechs() {
    return this.techRepo.find();
  }

  /** Throws BadRequestException (not a raw Error) so the admin panel's error snackbar shows the reason. */
  private validateTechEffectsDto(dto: Record<string, any>): Record<string, any> {
    if (!('effects' in dto)) return dto;
    try {
      return { ...dto, effects: validateEffects(dto.effects) };
    } catch (e: unknown) {
      throw new BadRequestException(e instanceof Error ? e.message : String(e));
    }
  }

  async createTech(dto: Record<string, any>) {
    const tech = this.techRepo.create(this.validateTechEffectsDto(dto));
    const saved = await this.techRepo.save(tech);
    await this.techEffectsService.invalidate();
    return saved;
  }

  async updateTech(id: string, dto: Record<string, any>) {
    const tech = await this.techRepo.findOne({ where: { id } });
    if (!tech) throw new NotFoundException(`Tech ${id} not found`);
    Object.assign(tech, this.validateTechEffectsDto(dto));
    const saved = await this.techRepo.save(tech);
    await this.techEffectsService.invalidate();
    return saved;
  }

  async deleteTech(id: string) {
    const tech = await this.techRepo.findOne({ where: { id } });
    if (!tech) throw new NotFoundException(`Tech ${id} not found`);
    await this.techRepo.remove(tech);
    await this.techEffectsService.invalidate();
  }

  // --- Troop Types ---

  findAllTroopTypes() {
    return this.troopTypeRepo.find();
  }

  async createTroopType(dto: Record<string, any>) {
    const { units: _, ...rest } = dto;
    const troopType = this.troopTypeRepo.create(rest);
    return this.troopTypeRepo.save(troopType);
  }

  async updateTroopType(id: string, dto: Record<string, any>) {
    const { units: _, ...safeDto } = dto;
    const troopType = await this.troopTypeRepo.findOne({ where: { id } });
    if (!troopType) throw new NotFoundException(`TroopType ${id} not found`);
    Object.assign(troopType, safeDto);
    return this.troopTypeRepo.save(troopType);
  }

  async deleteTroopType(id: string) {
    const troopType = await this.troopTypeRepo.findOne({ where: { id } });
    if (!troopType) throw new NotFoundException(`TroopType ${id} not found`);
    await this.troopTypeRepo.remove(troopType);
  }

  // --- Resources ---

  findAllResources() {
    return this.resourceRepo.find();
  }

  async createResource(dto: Record<string, any>) {
    const resource = this.resourceRepo.create(dto);
    const saved = await this.resourceRepo.save(resource);
    await this.userResourcesService.createRowsForNewResource(saved);
    return saved;
  }

  async updateResource(id: string, dto: Record<string, any>) {
    const resource = await this.resourceRepo.findOne({ where: { id } });
    if (!resource) throw new NotFoundException(`Resource ${id} not found`);
    Object.assign(resource, dto);
    return this.resourceRepo.save(resource);
  }

  async deleteResource(id: string) {
    const resource = await this.resourceRepo.findOne({ where: { id } });
    if (!resource) throw new NotFoundException(`Resource ${id} not found`);
    await this.resourceRepo.remove(resource);
  }

  // --- Goods ---

  findAllGoods() {
    return this.goodRepo.find();
  }

  async createGood(dto: Record<string, any>) {
    const good = this.goodRepo.create(dto);
    const saved = await this.goodRepo.save(good);
    await this.userGoodsService.createRowsForNewGood(saved);
    return saved;
  }

  async updateGood(id: string, dto: Record<string, any>) {
    const good = await this.goodRepo.findOne({ where: { id } });
    if (!good) throw new NotFoundException(`Good ${id} not found`);
    Object.assign(good, dto);
    return this.goodRepo.save(good);
  }

  async deleteGood(id: string) {
    const good = await this.goodRepo.findOne({ where: { id } });
    if (!good) throw new NotFoundException(`Good ${id} not found`);
    await this.goodRepo.remove(good);
  }

  // --- Classes ---

  findAllClasses() {
    return this.classRepo.find();
  }

  async createClass(dto: Record<string, any>) {
    const playerClass = this.classRepo.create(dto);
    return this.classRepo.save(playerClass);
  }

  async updateClass(id: string, dto: Record<string, any>) {
    const playerClass = await this.classRepo.findOne({ where: { id } });
    if (!playerClass) throw new NotFoundException(`Class ${id} not found`);
    Object.assign(playerClass, dto);
    return this.classRepo.save(playerClass);
  }

  async deleteClass(id: string) {
    const playerClass = await this.classRepo.findOne({ where: { id } });
    if (!playerClass) throw new NotFoundException(`Class ${id} not found`);
    await this.classRepo.remove(playerClass);
  }

  // --- Game Settings ---
  // Delegates to GameSettingsService (rather than a repo here) so its in-memory cache
  // invalidation stays in one place.

  getGameSettings() {
    return this.gameSettingsService.get();
  }

  updateGameSettings(dto: Record<string, any>) {
    return this.gameSettingsService.update(dto);
  }

  // --- Diplomatic Relations ---

  findAllDiplomaticRelations() {
    return this.diplomaticRelationRepo.find();
  }

  async createDiplomaticRelation(dto: Record<string, any>) {
    const relation = this.diplomaticRelationRepo.create(dto);
    return this.diplomaticRelationRepo.save(relation);
  }

  async updateDiplomaticRelation(id: string, dto: Record<string, any>) {
    const relation = await this.diplomaticRelationRepo.findOne({ where: { id } });
    if (!relation) throw new NotFoundException(`DiplomaticRelation ${id} not found`);
    Object.assign(relation, dto);
    return this.diplomaticRelationRepo.save(relation);
  }

  async deleteDiplomaticRelation(id: string) {
    const relation = await this.diplomaticRelationRepo.findOne({ where: { id } });
    if (!relation) throw new NotFoundException(`DiplomaticRelation ${id} not found`);
    await this.diplomaticRelationRepo.remove(relation);
  }

  // --- Wars ---

  findAllWars() {
    return this.warRepo.find({ relations: ['participants'] });
  }

  async createWar(dto: Record<string, any>) {
    const war = this.warRepo.create(dto);
    return this.warRepo.save(war);
  }

  async updateWar(id: string, dto: Record<string, any>) {
    const war = await this.warRepo.findOne({ where: { id } });
    if (!war) throw new NotFoundException(`War ${id} not found`);
    Object.assign(war, dto);
    return this.warRepo.save(war);
  }

  async deleteWar(id: string) {
    const war = await this.warRepo.findOne({ where: { id } });
    if (!war) throw new NotFoundException(`War ${id} not found`);
    await this.warRepo.remove(war);
  }

  // --- News Wall (moderation: list + delete only, no admin-authored content) ---

  findAllNewsAgencies() {
    return this.newsAgencyRepo
      .createQueryBuilder('agency')
      .leftJoin('agency.user', 'user')
      .addSelect(['user.id', 'user.country_name', 'user.login'])
      .orderBy('agency.createdAt', 'DESC')
      .getMany();
  }

  async deleteNewsAgency(id: string) {
    const agency = await this.newsAgencyRepo.findOne({ where: { id } });
    if (!agency) throw new NotFoundException(`News agency ${id} not found`);
    await this.newsAgencyRepo.remove(agency);
  }

  findAllNewsArticles() {
    return this.newsArticleRepo
      .createQueryBuilder('article')
      .leftJoin('article.agency', 'agency')
      .addSelect(['agency.id', 'agency.name'])
      .leftJoin('agency.user', 'user')
      .addSelect(['user.id', 'user.country_name'])
      .orderBy('article.createdAt', 'DESC')
      .getMany();
  }

  async deleteNewsArticle(id: string) {
    const article = await this.newsArticleRepo.findOne({ where: { id } });
    if (!article) throw new NotFoundException(`News article ${id} not found`);
    await this.newsArticleRepo.remove(article);
  }
}
