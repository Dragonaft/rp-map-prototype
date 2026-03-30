import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ): Promise<ActionQueue> {
    // Validate neighbor provinces for INVADE and TRANSFER_TROOPS actions
    if (actionType === ActionType.INVADE || actionType === ActionType.TRANSFER_TROOPS) {
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

      // Validate troop count
      if (!actionData.troops_number || actionData.troops_number <= 0) {
        throw new BadRequestException('troops_number must be greater than 0');
      }

      if (actionData.troops_number > fromProvince.local_troops) {
        throw new BadRequestException('Not enough troops in the source province');
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

  async retractAction(userId: string, actionId: number): Promise<ActionQueue> {
    const action = await this.actionQueueRepo.findOne({
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

    action.status = ActionStatus.RETRACTED;
    return await this.actionQueueRepo.save(action);
  }

  async getPendingActionsForExecution(): Promise<ActionQueue[]> {
    return await this.actionQueueRepo.find({
      where: {
        status: ActionStatus.PENDING,
      },
      order: { order: 'ASC' },
    });
  }

  async updateActionStatus(
    actionId: number,
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
