import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActionQueue, ActionStatus, ActionType } from './entities/action-queue.entity';
import { ActionsLog } from './entities/actions-log.entity';
import { Province } from '../provinces/entities/province.entity';

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(ActionQueue)
    private readonly actionQueueRepo: Repository<ActionQueue>,
    @InjectRepository(ActionsLog)
    private readonly actionsLogRepo: Repository<ActionsLog>,
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  async createAction(
    userId: string,
    actionType: ActionType,
    actionData: any,
  ): Promise<any> {

    // Validate neighbor provinces for INVADE and TRANSFER_TROOPS actions
    if (actionType === ActionType.INVADE) {
      const { from_province_id, to_province_id } = actionData;

      if (!from_province_id || !to_province_id) {
        throw new BadRequestException('from_province_id and to_province_id are required');
      }

      // Fetch the source province
      const fromProvince = await this.provinceRepo.findOne({
        where: { id: from_province_id },
      });

      if (!fromProvince) {
        throw new NotFoundException('Source province not found');
      }

      // Validate that the user owns the source province
      if (fromProvince.user_id !== userId) {
        throw new BadRequestException('You do not own the source province');
      }

      // Validate that the target province is a neighbor
      if (!fromProvince.neighbor_ids || !fromProvince.neighbor_ids.includes(to_province_id)) {
        throw new BadRequestException('Target province is not a neighbor of the source province');
      }

      const requestedTroops = Number(actionData.troops_number);

      // Validate troop count
      if (!Number.isFinite(requestedTroops) || requestedTroops <= 0) {
        throw new BadRequestException('troops_number must be greater than 0');
      }

      // 1) Check other invade actions of user from this source province
      const otherInvadeActions = await this.actionQueueRepo.find({
        where: {
          userId,
          actionType: ActionType.INVADE,
          status: ActionStatus.PENDING,
        },
      });

      // 2) Calculate used troops by invade actions from this province
      const usedTroopsByInvades = otherInvadeActions.reduce((sum, action) => {
        if (action.actionData?.from_province_id !== from_province_id) return sum;
        const n = Number(action.actionData?.troops_number ?? 0);
        if (!Number.isFinite(n) || n <= 0) return sum;
        return sum + n;
      }, 0);

      const totalUsedTroops = usedTroopsByInvades + requestedTroops;

      // 3) Ensure total reserved troops do not exceed original province troops
      if (totalUsedTroops > fromProvince.local_troops) {
        throw new BadRequestException('Not enough troops in the source province');
      }

      // 4) Calculate remaining troops after current invade reservations
      const remainingTroops = fromProvince.local_troops - totalUsedTroops;

      // Keep normalized numeric troops in saved action
      actionData.troops_number = requestedTroops;

      const allActions = await this.actionQueueRepo.find();
      const action = this.actionQueueRepo.create({
        userId,
        actionType,
        actionData,
        order: allActions.length + 1,
        status: ActionStatus.PENDING,
      });

      const createdAction = await this.actionQueueRepo.save(action);

      // 5) Return created action + recalculated source province troops for FE
      return {
        action: createdAction,
        province: {
          id: from_province_id,
          localTroops: remainingTroops,
        },
      };
    }

    const allActions = await this.actionQueueRepo.find();

    const action = this.actionQueueRepo.create({
      userId,
      actionType,
      actionData,
      order: allActions.length + 1,
      status: ActionStatus.PENDING,
    });

    return await this.actionQueueRepo.save(action);
  }

  async getUserActions(userId: string): Promise<ActionQueue[]> {
    return await this.actionQueueRepo.find({
      where: { userId },
      order: { order: 'ASC' },
    });
  }

  async getUserPendingActions(userId: string): Promise<ActionQueue[]> {
    return await this.actionQueueRepo.find({
      where: { userId, status: ActionStatus.PENDING },
      order: { order: 'ASC' },
    });
  }

  /**
   * Total troops committed in pending/processing INVADE or TRANSFER_TROOPS actions,
   * grouped by source province id (for adjusting displayed local_troops).
   */
  async getReservedTroopMovesByFromProvince(userId: string): Promise<Map<string, number>> {
    const actions = await this.actionQueueRepo.find({
      where: {
        userId,
        status: In([ActionStatus.PENDING, ActionStatus.PROCESSING]),
        actionType: In([ActionType.INVADE, ActionType.TRANSFER_TROOPS]),
      },
    });

    const byFrom = new Map<string, number>();
    for (const action of actions) {
      const fromId = action.actionData?.from_province_id as string | undefined;
      const n = action.actionData?.troops_number;
      if (fromId && typeof n === 'number' && n > 0) {
        byFrom.set(fromId, (byFrom.get(fromId) ?? 0) + n);
      }
    }
    return byFrom;
  }

  async retractAction(userId: string, actionId: string): Promise<any> {
    return await this.actionQueueRepo.manager.transaction(async (manager) => {
      const action = await manager.findOne(ActionQueue, {
        where: {
          id: actionId,
          userId,
          status: ActionStatus.PENDING,
        },
      });

      if (!action) {
        throw new NotFoundException(
          'Action not found or already executed/retracted',
        );
      }

      const deletedOrder = action.order;
      let provincePayload: { id: string; localTroops: number } | null = null;

      if (action.actionType === ActionType.INVADE) {
        // 1) Get source province id from actionData
        const fromProvinceId = action.actionData?.from_province_id as string | undefined;
        if (fromProvinceId) {
          // 2) Get province by from_province_id
          const fromProvince = await manager.findOne(Province, {
            where: { id: fromProvinceId },
          });

          if (fromProvince && typeof fromProvince.local_troops === 'number') {
            const invadeActions = await manager.find(ActionQueue, {
              where: {
                userId,
                actionType: ActionType.INVADE,
                status: ActionStatus.PENDING,
              },
            });

            // 3) Calculate used troops by invade actions from this province
            const usedTroopsFromProvince = invadeActions.reduce((sum, queuedAction) => {
              if (queuedAction.actionData?.from_province_id !== fromProvinceId) return sum;
              const n = Number(queuedAction.actionData?.troops_number ?? 0);
              if (!Number.isFinite(n) || n <= 0) return sum;
              return sum + n;
            }, 0);

            // 4) Subtract used troops from original province troops
            const troopsAfterAllQueuedInvades = fromProvince.local_troops - usedTroopsFromProvince;

            // 5) Add troops amount from deleting action (to get post-delete remaining)
            const deletingActionTroops = Number(action.actionData?.troops_number ?? 0);
            const remainingTroops =
              troopsAfterAllQueuedInvades + (Number.isFinite(deletingActionTroops) ? deletingActionTroops : 0);

            provincePayload = {
              id: fromProvinceId,
              localTroops: Math.max(0, remainingTroops),
            };
          }
        }
      }

      await manager.remove(ActionQueue, action);

      await manager
        .createQueryBuilder()
        .update(ActionQueue)
        .set({ order: () => '`order` - 1' })
        .where('`order` > :deletedOrder', { deletedOrder })
        .execute();

      // 6) Return deleted action and recalculated province payload for FE
      return {
        action,
        province: provincePayload,
      };
    });
  }

  /**
   * All pending rows sorted for inspection; global execution order is `order` ASC, then `createdAt` ASC.
   */
  async getPendingActionsForExecution(): Promise<ActionQueue[]> {
    return await this.actionQueueRepo.find({
      where: {
        status: ActionStatus.PENDING,
      },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Next action to run: lowest `order` among PENDING rows, then oldest `createdAt` if `order` ties.
   */
  async findNextPendingActionInOrder(): Promise<ActionQueue | null> {
    return await this.actionQueueRepo.findOne({
      where: { status: ActionStatus.PENDING },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async updateActionStatus(
    actionId: string,
    status: ActionStatus,
    failureReason?: string,
  ): Promise<void> {
    await this.actionQueueRepo.update(actionId, {
      status,
      failureReason,
    });
  }

  async getAllLogs(limit: number = 50, offset: number = 0): Promise<{
    logs: ActionsLog[];
    total: number;
  }> {
    const [logs, total] = await this.actionsLogRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { logs, total };
  }

  async getLogById(id: number): Promise<ActionsLog> {
    const log = await this.actionsLogRepo.findOne({ where: { id } });

    if (!log) {
      throw new NotFoundException(`Execution log with ID ${id} not found`);
    }

    return log;
  }

  async getLogsByTimetable(timetable: string): Promise<ActionsLog[]> {
    return await this.actionsLogRepo.find({
      where: { timetable },
      order: { createdAt: 'DESC' },
    });
  }

  async getUserActionsFromLogs(userId: string, limit: number = 50): Promise<{
    logs: any[];
    total: number;
  }> {
    // Get all logs and filter actions by userId
    const allLogs = await this.actionsLogRepo.find({
      order: { createdAt: 'DESC' },
      take: limit * 2, // Get extra to ensure we have enough after filtering
    });

    const userLogs = allLogs
      .map(log => ({
        executionId: log.data.executionId,
        timetable: log.timetable,
        executedAt: log.createdAt,
        actions: log.data.executedActions.filter(
          action => action.userId === userId
        ),
      }))
      .filter(log => log.actions.length > 0)
      .slice(0, limit);

    return {
      logs: userLogs,
      total: userLogs.length,
    };
  }
}
