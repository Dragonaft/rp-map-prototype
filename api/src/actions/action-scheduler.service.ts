import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActionsService } from './actions.service';
import { ActionExecutionStateService } from './action-execution-state.service';
import { ActionExecutorService, ExecutionContext } from './action-executor.service';
import { UpkeepActionService } from './upkeep-action.service';
import { IncomeActionService } from './income-action.service';
import { UserStateLoaderService } from './user-state-loader.service';
import { ActionsLog, ExecutedAction } from './entities/actions-log.entity';
import { ExecutionLock } from './entities/execution-lock.entity';
import { ActionQueue, ActionStatus } from './entities/action-queue.entity';
import { Army } from '../armies/entities/army.entity';
import { ArmyUnit } from '../armies/entities/army-unit.entity';
import { Province } from '../provinces/entities/province.entity';
import {
  ARMY_MIN_SIZE,
  CASUALTY_FLOOR,
  applyCasualties,
  armyAttackPower,
  armyDefensePower,
  armyTotalTroops,
  computeBuildModifier,
} from './combat-calculator';
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
    private readonly userStateLoader: UserStateLoaderService,
    private readonly actionExecutionState: ActionExecutionStateService,
    private readonly dataSource: DataSource,
  ) {
    // Create unique instance ID (hostname + process ID)
    this.instanceId = `${os.hostname()}-${process.pid}`;
  }

  // TODO: Create custom cron setup
  @Cron('0 13 * * *', { timeZone: 'Europe/Kyiv' }) // Every day at 13:00 Kyiv time
  async executeNoonActions() {
    await this.executeScheduledActions('13:00');
  }

  @Cron('0 20 * * *', { timeZone: 'Europe/Kyiv' }) // Every day at 200:00 Kyiv time
  async executeEveningActions() {
    await this.executeScheduledActions('20:00');
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
      await this.dataSource.transaction(async (manager) => {
        const state = await this.userStateLoader.load(manager);
        await this.incomeAction.execute(state, manager);
        await this.upkeepAction.execute(state, manager);
      });
    } catch (error) {
      this.logger.error('Income/upkeep phase failed; continuing with queued actions', error);
    }

    const executionId = uuidv4();
    const executionStartTime = new Date();
    const executedActions: ExecutedAction[] = [];
    let successfulActions = 0;
    let failedActions = 0;

    // Per-turn context shared across every action in this turn. Handlers use it
    // to enforce per-turn invariants (e.g. one ARMY_MOVE per army per turn).
    const ctx: ExecutionContext = { movedArmyIds: new Set<string>() };

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
          const result = await this.actionExecutor.executeAction(action, ctx);

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

      // Post-processing integrity checks
      await this.disbandWeakArmies();
      await this.resolveArmyConflicts();
      await this.syncProvinceOwnershipWithArmies();

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

      await queryRunner.manager.query(
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

  /**
   * Delete any army with fewer than ARMY_MIN_SIZE (100) total troops.
   */
  private async disbandWeakArmies(): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const armies = await manager.find(Army, {
          relations: ['units', 'units.troopType'],
        });

        let disbanded = 0;
        for (const army of armies) {
          if (armyTotalTroops(army) < ARMY_MIN_SIZE) {
            await manager.delete(ArmyUnit, { army_id: army.id });
            await manager.delete(Army, army.id);
            disbanded++;
            this.logger.warn(
              `Army ${army.id} (user ${army.user_id}) disbanded – only ${armyTotalTroops(army)} troops`,
            );
          }
        }

        if (disbanded > 0) {
          this.logger.log(`disbandWeakArmies: removed ${disbanded} army(ies)`);
        }
      });
    } catch (error) {
      this.logger.error('Error during weak army cleanup:', error);
    }
  }

  /**
   * If multiple armies from different users share a province, resolve combat.
   * Defender = army whose user owns the province; if none, a random army claims it first.
   * Remaining attackers fight the defender one by one.
   */
  private async resolveArmyConflicts(): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const armies = await manager.find(Army, {
          relations: ['units', 'units.troopType'],
        });

        // Group armies by province
        const byProvince = new Map<string, Army[]>();
        for (const army of armies) {
          const list = byProvince.get(army.province_id) ?? [];
          list.push(army);
          byProvince.set(army.province_id, list);
        }

        for (const [provinceId, armiesInProvince] of byProvince) {
          // Collect unique user ids
          const userIds = new Set(armiesInProvince.map((a) => a.user_id));
          if (userIds.size <= 1) continue; // No conflict

          const province = await manager.findOne(Province, {
            where: { id: provinceId },
            relations: ['provinceBuildings', 'provinceBuildings.building'],
          });
          if (!province || province.type === 'water') continue;

          this.logger.warn(
            `Province ${provinceId}: ${userIds.size} users' armies detected – resolving combat`,
          );

          // Determine defender: user who owns the province
          let defenderUserId = province.user_id;

          // If no army belongs to the province owner, the first user (sorted for
          // determinism) takes provisional ownership and defends.
          if (!defenderUserId || !armiesInProvince.some((a) => a.user_id === defenderUserId)) {
            defenderUserId = [...userIds].sort()[0];
            province.user_id = defenderUserId;
            await manager.save(Province, province);
            this.logger.warn(
              `Province ${provinceId}: no owner army present, assigned to user ${defenderUserId}`,
            );
          }

          // Split into defender armies and attacker armies
          let defenderArmies = armiesInProvince.filter((a) => a.user_id === defenderUserId);
          const attackerGroups = new Map<string, Army[]>();
          for (const army of armiesInProvince) {
            if (army.user_id === defenderUserId) continue;
            const group = attackerGroups.get(army.user_id) ?? [];
            group.push(army);
            attackerGroups.set(army.user_id, group);
          }

          // Deterministic, fair engagement order: strongest attacker strikes
          // first, ties broken by user id. Without this the order is whatever
          // the DB happened to return, so contested-province outcomes were
          // effectively random.
          const orderedAttackers = [...attackerGroups.entries()].sort((a, b) => {
            const powerA = a[1].reduce((sum, x) => sum + armyAttackPower(x), 0);
            const powerB = b[1].reduce((sum, x) => sum + armyAttackPower(x), 0);
            if (powerB !== powerA) return powerB - powerA;
            return a[0].localeCompare(b[0]);
          });

          // Process each attacker group sequentially
          for (const [attackerUserId, attackerArmies] of orderedAttackers) {
            const attackerPower = attackerArmies.reduce(
              (sum, a) => sum + armyAttackPower(a), 0,
            );

            const defenderBasePower = defenderArmies.reduce(
              (sum, a) => sum + armyDefensePower(a), 0,
            );
            const buildingModifier = computeBuildModifier(province.buildings);
            const defenderPower = defenderBasePower * buildingModifier;

            if (attackerPower > defenderPower) {
              // Attacker wins
              const attackerCasualtyRate = Math.max(
                CASUALTY_FLOOR,
                defenderPower / (attackerPower + defenderPower),
              );
              for (const a of attackerArmies) applyCasualties(a, attackerCasualtyRate);

              // Destroy all defender armies
              for (const da of defenderArmies) {
                await manager.delete(ArmyUnit, { army_id: da.id });
                await manager.delete(Army, da.id);
              }

              // Save surviving attacker armies, disband if too weak
              const survivingAttackers: Army[] = [];
              for (const a of attackerArmies) {
                if (armyTotalTroops(a) < ARMY_MIN_SIZE) {
                  await manager.delete(ArmyUnit, { army_id: a.id });
                  await manager.delete(Army, a.id);
                } else {
                  await manager.save(ArmyUnit, a.units);
                  await manager.save(Army, a);
                  survivingAttackers.push(a);
                }
              }

              // Transfer province ownership
              province.user_id = attackerUserId;
              await manager.save(Province, province);
              defenderArmies = survivingAttackers;

              this.logger.log(
                `Province ${provinceId}: user ${attackerUserId} defeated defender ${defenderUserId}`,
              );
              defenderUserId = attackerUserId;
            } else {
              // Defender wins
              const maxAttackerLoseRate = 0.8;
              const baseAttackerRateCoeff = 1.4;
              const attackerRate =
                (defenderPower / (defenderPower + attackerPower)) * baseAttackerRateCoeff;
              const attackerCasualtyRate = Math.min(
                maxAttackerLoseRate, Math.max(CASUALTY_FLOOR, attackerRate),
              );

              for (const a of attackerArmies) {
                applyCasualties(a, attackerCasualtyRate);
                if (armyTotalTroops(a) < ARMY_MIN_SIZE) {
                  await manager.delete(ArmyUnit, { army_id: a.id });
                  await manager.delete(Army, a.id);
                } else {
                  await manager.save(ArmyUnit, a.units);
                  await manager.save(Army, a);
                }
              }

              // Defender takes minor losses
              const baseDefenderRateCoeff = 0.7;
              const baseDefenderRate =
                (attackerPower / (attackerPower + defenderPower)) * baseDefenderRateCoeff;
              const defenderCasualtyRate = Math.max(CASUALTY_FLOOR, baseDefenderRate);

              const survivingDefenders: Army[] = [];
              for (const da of defenderArmies) {
                applyCasualties(da, defenderCasualtyRate);
                if (armyTotalTroops(da) < ARMY_MIN_SIZE) {
                  await manager.delete(ArmyUnit, { army_id: da.id });
                  await manager.delete(Army, da.id);
                } else {
                  await manager.save(ArmyUnit, da.units);
                  await manager.save(Army, da);
                  survivingDefenders.push(da);
                }
              }
              defenderArmies = survivingDefenders;

              this.logger.log(
                `Province ${provinceId}: defender ${defenderUserId} repelled attacker ${attackerUserId}`,
              );
            }
          }
        }
      });
    } catch (error) {
      this.logger.error('Error during army conflict resolution:', error);
    }
  }

  /**
   * After all actions are processed, verify that every non-water province
   * with an army on it is owned by that army's user.
   */
  private async syncProvinceOwnershipWithArmies(): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const armies = await manager.find(Army);

        if (armies.length === 0) return;

        const provinceIds = [...new Set(armies.map((a) => a.province_id))];
        const provinces = await manager
          .createQueryBuilder(Province, 'p')
          .where('p.id IN (:...ids)', { ids: provinceIds })
          .getMany();

        const provinceMap = new Map(provinces.map((p) => [p.id, p]));
        let updated = 0;

        for (const army of armies) {
          const province = provinceMap.get(army.province_id);
          if (!province || province.type === 'water') continue;

          if (province.user_id !== army.user_id) {
            province.user_id = army.user_id;
            await manager.save(Province, province);
            updated++;
            this.logger.warn(
              `Province ${province.id} ownership corrected to user ${army.user_id} (army ${army.id})`,
            );
          }
        }

        if (updated > 0) {
          this.logger.log(`syncProvinceOwnershipWithArmies: corrected ${updated} province(s)`);
        }
      });
    } catch (error) {
      this.logger.error('Error during province ownership sync:', error);
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
