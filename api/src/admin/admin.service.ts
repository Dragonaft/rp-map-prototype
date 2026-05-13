import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Building } from '../buildings/entities/building.entity';
import { Army } from '../armies/entities/army.entity';
import { Tech } from '../techs/entities/tech.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Building) private readonly buildingRepo: Repository<Building>,
    @InjectRepository(Army) private readonly armyRepo: Repository<Army>,
    @InjectRepository(Tech) private readonly techRepo: Repository<Tech>,
  ) {}

  // --- Users ---

  async findAllUsers() {
    const users = await this.userRepo.find();
    return users.map(({ password: _, ...rest }) => rest);
  }

  async createUser(dto: Record<string, any>) {
    const { password, ...rest } = dto;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({ ...rest, password: hashedPassword, is_new: rest.is_new ?? true });
    const saved = await this.userRepo.save(user);
    const { password: _, ...result } = saved as any;
    return result;
  }

  async updateUser(id: string, dto: Record<string, any>) {
    const { password: _, provinces: __, ...safeDto } = dto;
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    Object.assign(user, safeDto);
    const saved = await this.userRepo.save(user);
    const { password: _p, ...result } = saved as any;
    return result;
  }

  async deleteUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    await this.userRepo.remove(user);
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

  async createTech(dto: Record<string, any>) {
    const tech = this.techRepo.create(dto);
    return this.techRepo.save(tech);
  }

  async updateTech(id: string, dto: Record<string, any>) {
    const tech = await this.techRepo.findOne({ where: { id } });
    if (!tech) throw new NotFoundException(`Tech ${id} not found`);
    Object.assign(tech, dto);
    return this.techRepo.save(tech);
  }

  async deleteTech(id: string) {
    const tech = await this.techRepo.findOne({ where: { id } });
    if (!tech) throw new NotFoundException(`Tech ${id} not found`);
    await this.techRepo.remove(tech);
  }
}
