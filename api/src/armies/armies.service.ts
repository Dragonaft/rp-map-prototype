import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Army } from './entities/army.entity';
import { TroopType } from './entities/troop-type.entity';
import { ActionQueue, ActionStatus, ActionType } from '../actions/entities/action-queue.entity';
import { User } from '../users/entities/user.entity';
import { UserClasses } from '../users/types/users.types';

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
    @InjectRepository(ActionQueue)
    private readonly actionQueueRepo: Repository<ActionQueue>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  getUserArmies = (userId: string): Promise<Army[]> =>
    this.armyRepo.find({
      where: { user_id: userId },
      relations: ['units', 'units.troopType'],
    });

  async getAllArmies(requestingUserId: string): Promise<any[]> {
    const user = await this.userRepo.findOne({ where: { id: requestingUserId } });
    const hasSpyNetwork =
      user?.class === UserClasses.GUILD &&
      (user?.completed_research ?? []).includes('guild.spy_network');

    const allArmies = await this.armyRepo.find({
      relations: ['units', 'units.troopType'],
    });

    return allArmies.map((army) => {
      if (army.user_id === requestingUserId) return army;

      // Enemy army — strip unit composition; reveal total only with spy network
      const totalTroops = hasSpyNetwork
        ? (army.units ?? []).reduce((s, u) => s + u.count, 0)
        : null;

      return {
        id: army.id,
        name: army.name,
        user_id: army.user_id,
        province_id: army.province_id,
        flat_upkeep: 0,
        units: [],
        totalTroops,
      };
    });
  }

  async getTroopTypes(userId: string): Promise<TroopType[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const allTypes = await this.troopTypeRepo.find();

    return allTypes.filter((tt) => {
      if (tt.tech_requirement && !(user?.completed_research ?? []).includes(tt.tech_requirement)) {
        return false;
      }
      const requiredClass = CLASS_RESTRICTED_TROOPS[tt.key];
      if (requiredClass && user?.class !== requiredClass) {
        return false;
      }
      return true;
    });
  }

  async createArmyAction(
    userId: string,
    body: { province_id: string; name?: string; units: { troop_type_key: string; count: number }[] },
  ): Promise<{ action: ActionQueue }> {
    const allActions = await this.actionQueueRepo.find();
    const action = this.actionQueueRepo.create({
      userId,
      actionType: ActionType.ARMY_CREATE,
      actionData: { province_id: body.province_id, name: body.name, units: body.units },
      order: allActions.length + 1,
      status: ActionStatus.PENDING,
    });
    const saved = await this.actionQueueRepo.save(action);
    return { action: saved };
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

    const allActions = await this.actionQueueRepo.find();
    const action = this.actionQueueRepo.create({
      userId,
      actionType: ActionType.ARMY_DISBAND,
      actionData: { army_id: id },
      order: allActions.length + 1,
      status: ActionStatus.PENDING,
    });
    const saved = await this.actionQueueRepo.save(action);
    return { action: saved };
  }

  getTroopTypeByKey = (key: string): Promise<TroopType | null> =>
    this.troopTypeRepo.findOne({ where: { key } });
}
