import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
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
    scheduledFor: Date,
  ): Promise<ActionQueue> {
    const action = this.actionQueueRepo.create({
      userId,
      actionType,
      actionData,
      scheduledFor,
      status: ActionStatus.PENDING,
    });

    return await this.actionQueueRepo.save(action);
  }

  async getUserActions(userId: string): Promise<ActionQueue[]> {
    return await this.actionQueueRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async getUserPendingActions(userId: string): Promise<ActionQueue[]> {
    return await this.actionQueueRepo.find({
      where: { userId, status: ActionStatus.PENDING },
      order: { createdAt: 'ASC' },
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
        scheduledFor: LessThanOrEqual(new Date()),
      },
      order: { createdAt: 'ASC' },
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
