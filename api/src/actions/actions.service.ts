import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActionQueue, ActionStatus, ActionType } from './entities/action-queue.entity';
import { ActionsLog } from './entities/actions-log.entity';

/** Hard ceiling on a user's queued (PENDING) actions, to bound queue size and turn length. */
const MAX_PENDING_ACTIONS_PER_USER = 200;

/** Upper bound on any single troop count in a payload — guards against absurd/overflow values. */
const MAX_TROOP_COUNT = 1_000_000;

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
    // 1) Reject malformed payloads up front (cheap, clear 400s instead of
    //    obscure failures deep in the turn executor).
    this.validateActionPayload(actionType, actionData);

    // 2) Cap the per-user queue so a client (or a Postman script) can't flood it.
    const pendingCount = await this.actionQueueRepo.count({
      where: { userId, status: ActionStatus.PENDING },
    });
    if (pendingCount >= MAX_PENDING_ACTIONS_PER_USER) {
      throw new BadRequestException(
        `Too many pending actions (max ${MAX_PENDING_ACTIONS_PER_USER}). Retract some or wait for the next turn.`,
      );
    }

    // 3) Reject duplicates that are one-per-turn or idempotent by nature.
    await this.assertNotDuplicate(userId, actionType, actionData);

    // TODO: Move count on db level
    const total = await this.actionQueueRepo.count();

    const action = this.actionQueueRepo.create({
      userId,
      actionType,
      actionData,
      order: total + 1,
      status: ActionStatus.PENDING,
    });

    return await this.actionQueueRepo.save(action);
  }

  /**
   * Validates that `actionData` carries the fields the matching executor handler
   * will read. Field names mirror the handlers and the web-map client payloads.
   */
  private validateActionPayload(actionType: ActionType, actionData: any): void {
    if (actionData === null || typeof actionData !== 'object' || Array.isArray(actionData)) {
      throw new BadRequestException('actionData must be an object');
    }

    switch (actionType) {
      case ActionType.BUILD:
        this.requireString(actionData, 'province_id');
        this.requireString(actionData, 'building_id');
        break;

      case ActionType.UPGRADE:
      case ActionType.REMOVE:
        this.requireString(actionData, 'province_id');
        this.requireString(actionData, 'province_building_id');
        break;

      case ActionType.COLONIZE:
        this.requireString(actionData, 'province_id');
        break;

      case ActionType.RESEARCH:
        this.requireString(actionData, 'tech_key');
        break;

      case ActionType.ARMY_MOVE:
        this.requireString(actionData, 'army_id');
        this.requireString(actionData, 'to_province_id');
        break;

      case ActionType.ARMY_DISBAND:
        this.requireString(actionData, 'army_id');
        break;

      case ActionType.ARMY_EDIT:
        this.requireString(actionData, 'army_id');
        this.requireString(actionData, 'troop_type_key');
        this.requireCount(actionData.count, 'count');
        break;

      case ActionType.ARMY_MERGE:
        this.requireString(actionData, 'source_army_id');
        this.requireString(actionData, 'target_army_id');
        if (actionData.source_army_id === actionData.target_army_id) {
          throw new BadRequestException('source_army_id and target_army_id must be different');
        }
        break;

      case ActionType.ARMY_CREATE:
        this.requireString(actionData, 'province_id');
        if (actionData.name != null && typeof actionData.name !== 'string') {
          throw new BadRequestException('name must be a string');
        }
        this.validateUnits(actionData.units);
        break;

      case ActionType.ARMY_RECRUIT:
        this.requireString(actionData, 'army_id');
        this.validateUnits(actionData.units);
        break;

      // TRANSFER_TROOPS / DISBAND are legacy/unimplemented stubs with no payload
      // contract and nothing queues them, so no shape is enforced here.
      default:
        break;
    }
  }

  private requireString(data: any, field: string): void {
    const value = data?.[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException(`${field} is required and must be a non-empty string`);
    }
  }

  private requireCount(value: any, field: string): void {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value <= 0 ||
      value > MAX_TROOP_COUNT
    ) {
      throw new BadRequestException(
        `${field} must be an integer between 1 and ${MAX_TROOP_COUNT}`,
      );
    }
  }

  private validateUnits(units: any): void {
    if (!Array.isArray(units) || units.length === 0) {
      throw new BadRequestException('units must be a non-empty array');
    }
    for (const unit of units) {
      if (unit === null || typeof unit !== 'object') {
        throw new BadRequestException('each unit must be an object');
      }
      this.requireString(unit, 'troop_type_key');
      this.requireCount(unit.count, 'count');
    }
  }

  /**
   * Rejects duplicate pending actions that are one-per-turn or idempotent. The
   * executor still enforces these at runtime; this just gives immediate feedback.
   */
  private async assertNotDuplicate(
    userId: string,
    actionType: ActionType,
    actionData: any,
  ): Promise<void> {
    if (actionType === ActionType.ARMY_MOVE) {
      const pending = await this.actionQueueRepo.find({
        where: { userId, actionType: ActionType.ARMY_MOVE, status: ActionStatus.PENDING },
      });
      if (pending.some((a) => a.actionData?.army_id === actionData.army_id)) {
        throw new BadRequestException('This army already has a pending move this turn');
      }
    }

    if (actionType === ActionType.RESEARCH) {
      const pending = await this.actionQueueRepo.find({
        where: { userId, actionType: ActionType.RESEARCH, status: ActionStatus.PENDING },
      });
      if (pending.some((a) => a.actionData?.tech_key === actionData.tech_key)) {
        throw new BadRequestException('This technology is already queued for research');
      }
    }
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
