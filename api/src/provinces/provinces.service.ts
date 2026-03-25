import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Province } from './entities/province.entity';
import { ProvincesUpdateBodyRequest } from './requests/provinces-update-body.request';
import { User } from "../users/entities/user.entity";
import { Building } from '../buildings/entities/building.entity';
import { AuthTokenType } from "../auth/types/auth.types";

@Injectable()
export class ProvincesService {
  constructor(
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getAll(userId: string) {
    // TODO: maybe optimize some to FE
    const provinces = await this.provinceRepository.find({
      relations: ['buildings']
    });

    // Hide local_troops for provinces not owned by the user
    return provinces.map(province => {
      if (province.user_id !== userId) {
        province.local_troops = null;
      }
      return province;
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

    const foundUser = await this.userRepository.findOne({ where: { id: user.userId } });

    if (!foundUser) {
      throw new NotFoundException(`User with id ${user.userId} not found`);
    }

    if (!province) {
      throw new NotFoundException(`Province with id ${id} not found`);
    }

    if (province.user_id !== null) {
      throw new Error(`Province is already occupied for user!`);
    }

    // Example: Add a building by id to the province
    const building = await this.buildingRepository.findOne({ where: { id: '5555f92e-4251-4193-ad0e-bb149682b1f6' } });
    if (building) {
      if (!province.buildings) {
        province.buildings = [];
      }
      province.buildings.push(building);
    }

    const updatedProvince = {
      ...province,
      local_troops: 1000,
      user_id: user.userId
    };

    Object.assign(province, updatedProvince);

    const updatedUser = {
      ...foundUser,
      is_new: false,
      troops: 3000,
      money: 5000,
    }

    await this.userRepository.save(updatedUser);
    await this.provinceRepository.save(province);

    return {
      user: updatedUser,
      province: province,
    }
  }
}
