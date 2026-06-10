import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Army } from './entities/army.entity';
import { TroopType } from './entities/troop-type.entity';
import { ActionQueue, ActionType } from '../actions/entities/action-queue.entity';
import { ActionsService } from '../actions/actions.service';
import { User } from '../users/entities/user.entity';
import { UserClasses } from '../users/types/users.types';
import { Province } from '../provinces/entities/province.entity';

const CLASS_RESTRICTED_TROOPS: Partial<Record<string, UserClasses>> = {
  noble_knights: UserClasses.NOBLE,
  paladins:      UserClasses.HOLY,
  mercenaries:   UserClasses.GUILD,
};

@Injectable()
export class ArmiesService {
  constructor(
    @InjectRepository(Army)
    private readonly armyRepo: Repository<Army>,
    @InjectRepository(TroopType)
    private readonly troopTypeRepo: Repository<TroopType>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
    private readonly actionsService: ActionsService,
  ) {}

  getUserArmies = (userId: string): Promise<Army[]> =>
    this.armyRepo.find({
      where: { user_id: userId },
      relations: ['units', 'units.troopType'],
    });

  async getAllArmies(requestingUserId: string): Promise<any[]> {
    const [ownedProvinces, allArmies] = await Promise.all([
      this.provinceRepo.find({
        where: { user_id: requestingUserId },
        select: { id: true, neighbor_ids: true },
      }),
      this.armyRepo.find({ relations: ['units', 'units.troopType'] }),
    ]);

    const visibleProvinceIds = new Set<string>();
    for (const province of ownedProvinces) {
      visibleProvinceIds.add(province.id);
      for (const neighborId of province.neighbor_ids ?? []) {
        visibleProvinceIds.add(neighborId);
      }
    }

    const result: any[] = [];
    for (const army of allArmies) {
      if (army.user_id === requestingUserId) {
        result.push(army);
        continue;
      }

      if (!visibleProvinceIds.has(army.province_id)) continue;

      const totalTroops = (army.units ?? []).reduce((s, u) => s + u.count, 0);
      result.push({
        id: army.id,
        name: army.name,
        user_id: army.user_id,
        province_id: army.province_id,
        flat_upkeep: 0,
        units: army.units,
        totalTroops,
      });
    }
    return result;
  }

  async getTroopTypes(userId: string): Promise<TroopType[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const allTypes = await this.troopTypeRepo.find();

    return allTypes.filter((tt) => {
      if (tt.tech_requirement && !(user?.completed_research ?? []).includes(tt.tech_requirement)) {
        return false;
      }
      const requiredClass = CLASS_RESTRICTED_TROOPS[tt.key];
      return !(requiredClass && user?.class !== requiredClass);

    });
  }

  async createArmyAction(
    userId: string,
    body: { province_id: string; name?: string; units: { troop_type_key: string; count: number }[] },
  ): Promise<{ action: ActionQueue }> {
    const action = await this.actionsService.createAction(userId, ActionType.ARMY_CREATE, {
      province_id: body.province_id,
      name: body.name,
      units: body.units,
    });
    return { action };
  }

  async updateArmyName(id: string, userId: string, name: string): Promise<Army> {
    const army = await this.armyRepo.findOne({ where: { id } });
    if (!army) throw new NotFoundException('Army not found');
    if (army.user_id !== userId) throw new BadRequestException('User does not own this army');
    army.name = name;
    return this.armyRepo.save(army);
  }

  async disbandArmyAction(id: string, userId: string): Promise<{ action: ActionQueue }> {
    const army = await this.armyRepo.findOne({ where: { id } });
    if (!army) throw new NotFoundException('Army not found');
    if (army.user_id !== userId) throw new BadRequestException('User does not own this army');

    const action = await this.actionsService.createAction(userId, ActionType.ARMY_DISBAND, {
      army_id: id,
    });
    return { action };
  }

  getTroopTypeByKey = (key: string): Promise<TroopType | null> =>
    this.troopTypeRepo.findOne({ where: { key } });
}
