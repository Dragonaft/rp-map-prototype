import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActionQueue, ActionStatus, ActionType } from './entities/action-queue.entity';
import { ActionsLog } from './entities/actions-log.entity';

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(ActionQueue)
    private readonly actionQueueRepo: Repository<ActionQueue>,
    @InjectRepository(ActionsLog)
    private readonly actionsLogRepo: Repository<ActionsLog>,
  ) {}

  async createAction(
    userId: string,
    actionType: ActionType,
    actionData: any,
  ): Promise<any> {

    // An army may only move once per turn. Reject a second pending move for the
    // same army so the client gets immediate feedback; the executor enforces the
    // same rule authoritatively at turn time (see ArmyMoveHandler).
    if (actionType === ActionType.ARMY_MOVE) {
      const { army_id } = actionData;

      if (!army_id) {
        throw new BadRequestException('army_id is required');
      }

      const pendingMoves = await this.actionQueueRepo.find({
        where: {
          userId,
          actionType: ActionType.ARMY_MOVE,
          status: ActionStatus.PENDING,
        },
      });

      const armyAlreadyMoving = pendingMoves.some(
        (move) => move.actionData?.army_id === army_id,
      );

      if (armyAlreadyMoving) {
        throw new BadRequestException('This army already has a pending move this turn');
      }
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
   * Total troops committed in pending/processing TRANSFER_TROOPS actions,
   * grouped by source province id (for adjusting displayed local_troops).
   */
  async getReservedTroopMovesByFromProvince(userId: string): Promise<Map<string, number>> {
    const actions = await this.actionQueueRepo.find({
      where: {
        userId,
        status: In([ActionStatus.PENDING, ActionStatus.PROCESSING]),
        actionType: ActionType.TRANSFER_TROOPS,
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

      await manager.remove(ActionQueue, action);

      await manager
        .createQueryBuilder()
        .update(ActionQueue)
        .set({ order: () => '`order` - 1' })
        .where('`order` > :deletedOrder', { deletedOrder })
        .execute();

      return {
        action,
        province: null,
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
