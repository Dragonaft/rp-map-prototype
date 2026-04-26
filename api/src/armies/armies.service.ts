import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Army } from './entities/army.entity';
import { TroopType } from './entities/troop-type.entity';

@Injectable()
export class ArmiesService {
  constructor(
    @InjectRepository(Army)
    private readonly armyRepo: Repository<Army>,
    @InjectRepository(TroopType)
    private readonly troopTypeRepo: Repository<TroopType>,
  ) {}

  getUserArmies = (userId: string): Promise<Army[]> =>
    this.armyRepo.find({
      where: { user_id: userId },
      relations: ['units', 'units.troopType'],
    });

  getTroopTypes = (): Promise<TroopType[]> => this.troopTypeRepo.find();

  getTroopTypeByKey = (key: string): Promise<TroopType | null> =>
    this.troopTypeRepo.findOne({ where: { key } });
}
