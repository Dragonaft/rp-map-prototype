import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActionsService } from './actions.service';
import { ActionExecutionStateService } from './action-execution-state.service';
import { ActionExecutorService } from './action-executor.service';
import { UpkeepActionService } from './upkeep-action.service';
import { IncomeActionService } from './income-action.service';
import { ActionsLog, ExecutedAction } from './entities/actions-log.entity';
import { ExecutionLock } from './entities/execution-lock.entity';
import { ActionQueue, ActionStatus } from './entities/action-queue.entity';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ActionSchedulerService {
  private readonly logger = new Logger(ActionSchedulerService.name);
  private readonly instanceId: string;

  constructor(
    @InjectRepository(ActionsLog)
    private readonly actionsLogRepo: Repository<ActionsLog>,
    @InjectRepository(ExecutionLock)
    private readonly executionLockRepo: Repository<ExecutionLock>,
    @InjectRepository(ActionQueue)
    private readonly actionQueueRepo: Repository<ActionQueue>,
    private readonly actionsService: ActionsService,
    private readonly actionExecutor: ActionExecutorService,
    private readonly incomeAction: IncomeActionService,
    private readonly upkeepAction: UpkeepActionService,
    private readonly actionExecutionState: ActionExecutionStateService,
    private readonly dataSource: DataSource,
  ) {
    // Create unique instance ID (hostname + process ID)
    this.instanceId = `${os.hostname()}-${process.pid}`;
  }

  // TODO: Create custom cron setup
  @Cron('0 12 * * *') // Every day at 12:00
  async executeNoonActions() {
    await this.executeScheduledActions('12:00');
  }

  @Cron('0 18 * * *') // Every day at 18:00
  async executeEveningActions() {
    await this.executeScheduledActions('18:00');
  }

  /**
   * Non-production only: runs pending actions every 2 minutes for local testing.
   * Uses the same timetable/lock as the 5-minute cron so both ticks cannot drain the queue twice at once.
   * Set NODE_ENV=production to disable; set DISABLE_FAST_ACTION_CRON=true to disable while keeping other non-prod behavior.
   */
  @Cron('*/2 * * * *')
  async executeDevFastActionsEvery2Min(): Promise<void> {
    if (!this.isFastDevCronEnabled()) {
      return;
    }
    await this.executeScheduledActions('dev-fast');
  }

  /**
   * Non-production only: same as every-2-minute dev cron, alternate cadence for manual testing.
   */
  @Cron('*/5 * * * *')
  async executeDevFastActionsEvery5Min(): Promise<void> {
    if (!this.isFastDevCronEnabled()) {
      return;
    }
    await this.executeScheduledActions('dev-fast');
  }

  private isFastDevCronEnabled(): boolean {
    if (process.env.DISABLE_FAST_ACTION_CRON === 'true') {
      return false;
    }
    return process.env.NODE_ENV !== 'production';
  }

  private async executeScheduledActions(timetable: string): Promise<void> {
    const lockKey = `action-execution-${timetable}`;

    // Try to acquire lock
    const lockAcquired = await this.acquireLock(lockKey);

    if (!lockAcquired) {
      this.logger.warn(
        `Could not acquire lock for ${timetable} execution. Another instance is running.`,
      );
      return;
    }

    this.logger.log(
      `Starting action execution for ${timetable} (Instance: ${this.instanceId}); strict global queue order (order ASC, createdAt ASC)`,
    );

    this.actionExecutionState.beginProcessing();

    try {
      await this.incomeAction.execute();
    } catch (error) {
      this.logger.error('Income action failed; continuing with upkeep and queued actions', error);
    }

    try {
      await this.upkeepAction.execute();
    } catch (error) {
      this.logger.error('Upkeep action failed; continuing with queued actions', error);
    }

    const executionId = uuidv4();
    const executionStartTime = new Date();
    const executedActions: ExecutedAction[] = [];
    let successfulActions = 0;
    let failedActions = 0;

    try {
      // Re-fetch the lowest pending `order` after each action so execution always runs 1 → n
      while (true) {
        const action = await this.actionsService.findNextPendingActionInOrder();
        if (!action) {
          break;
        }

        try {
          // Update status to PROCESSING
          await this.actionsService.updateActionStatus(action.id, ActionStatus.PROCESSING);

          // Execute the action
          const result = await this.actionExecutor.executeAction(action);

          if (result.success) {
            // Mark as completed
            await this.actionsService.updateActionStatus(action.id, ActionStatus.COMPLETED);
            successfulActions++;

            executedActions.push({
              id: action.id,
              userId: action.userId,
              actionType: action.actionType,
              actionData: action.actionData,
              status: ActionStatus.COMPLETED,
              order: action.order,
              executedAt: new Date(),
            });
          } else {
            // Mark as failed
            await this.actionsService.updateActionStatus(
              action.id,
              ActionStatus.FAILED,
              result.error,
            );
            failedActions++;

            executedActions.push({
              id: action.id,
              userId: action.userId,
              actionType: action.actionType,
              actionData: action.actionData,
              status: ActionStatus.FAILED,
              order: action.order,
              executedAt: new Date(),
            });
          }
        } catch (error) {
          this.logger.error(`Error executing action ${action.id}:`, error);

          await this.actionsService.updateActionStatus(
            action.id,
            ActionStatus.FAILED,
            error instanceof Error ? error.message : 'Unknown error',
          );
          failedActions++;

          executedActions.push({
            id: action.id,
            userId: action.userId,
            actionType: action.actionType,
            actionData: action.actionData,
            status: ActionStatus.FAILED,
            order: action.order,
            executedAt: new Date(),
          });
        }
      }

      this.logger.log(
        `Finished ordered execution for ${timetable}: ${executedActions.length} action(s) processed`,
      );

      const executionEndTime = new Date();

      // Create log entry
      if (executedActions.length > 0) {
        await this.actionsLogRepo.save({
          data: {
            executionId,
            executedActions,
            totalActions: executedActions.length,
            successfulActions,
            failedActions,
            executionStartTime,
            executionEndTime,
          },
          timetable,
        });

        this.logger.log(
          `Action execution completed for ${timetable}. Total: ${executedActions.length}, Success: ${successfulActions}, Failed: ${failedActions}`,
        );
      }

      // Clean up completed and failed actions from queue
      await this.cleanupExecutedActions();

    } catch (error) {
      this.logger.error(`Error during scheduled action execution for ${timetable}:`, error);
    } finally {
      this.actionExecutionState.endProcessing();
      await this.releaseLock(lockKey);
    }
  }

  private async acquireLock(lockKey: string): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      // Try to acquire lock with 5-minute timeout
      // If lock exists and is older than 5 minutes, consider it stale and acquire it
      const lockTimeout = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

      const result = await queryRunner.manager.query(
        `INSERT INTO execution_locks (lockKey, lockedAt, lockedBy)
         VALUES (?, NOW(), ?)
         ON DUPLICATE KEY UPDATE
           lockedAt = IF(lockedAt < ?, NOW(), lockedAt),
           lockedBy = IF(lockedAt < ?, ?, lockedBy)`,
        [lockKey, this.instanceId, lockTimeout, lockTimeout, this.instanceId],
      );

      // Check if we acquired the lock
      const lock = await queryRunner.manager.findOne(ExecutionLock, {
        where: { lockKey },
      });

      await queryRunner.commitTransaction();

      const acquired = lock?.lockedBy === this.instanceId;

      if (acquired) {
        this.logger.log(`Lock acquired: ${lockKey} by ${this.instanceId}`);
      }

      return acquired;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error acquiring lock ${lockKey}:`, error);
      return false;
    } finally {
      await queryRunner.release();
    }
  }

  private async releaseLock(lockKey: string): Promise<void> {
    try {
      await this.executionLockRepo.delete({ lockKey, lockedBy: this.instanceId });
      this.logger.log(`Lock released: ${lockKey} by ${this.instanceId}`);
    } catch (error) {
      this.logger.error(`Error releasing lock ${lockKey}:`, error);
    }
  }

  private async cleanupExecutedActions(): Promise<void> {
    try {
      // Delete actions that are COMPLETED, FAILED, or RETRACTED
      const result = await this.actionQueueRepo
        .createQueryBuilder()
        .delete()
        .from(ActionQueue)
        .where('status IN (:...statuses)', {
          statuses: [ActionStatus.COMPLETED, ActionStatus.FAILED, ActionStatus.RETRACTED],
        })
        .execute();

      this.logger.log(`Cleaned up ${result.affected} executed actions from queue`);
    } catch (error) {
      this.logger.error('Error cleaning up executed actions:', error);
    }
  }
}
