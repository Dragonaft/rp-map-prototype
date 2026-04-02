import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { Building } from '../buildings/entities/building.entity';
import { Province } from '../provinces/entities/province.entity';
import { ActionQueue, ActionType } from './entities/action-queue.entity';

const DEFENSIVE_BUILDING_TYPES = new Set<string>([
  BuildingTypes.FORT,
  BuildingTypes.CAPITOL,
  'CAPITAL',
]);

function parseBuildingModifier(modifier: string | null | undefined): number {
  const n = Number(modifier);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function computeBuildModifier(buildings: Building[] | undefined): number {
  if (!buildings?.length) {
    return 1;
  }
  let sum = 0;
  for (const b of buildings) {
    if (DEFENSIVE_BUILDING_TYPES.has(b.type)) {
      sum += parseBuildingModifier(b.modifier);
    }
  }
  return sum > 0 ? sum : 1;
}

export interface ActionHandler {
  handle(action: ActionQueue): Promise<void>;
}

@Injectable()
export class BuildActionHandler implements ActionHandler {
  private readonly logger = new Logger(BuildActionHandler.name);

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing BUILD action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    // TODO: Implement actual building logic
    // Example:
    // - Validate user has resources
    // - Check province ownership
    // - Create building in database
    // - Deduct resources from user

    // Simulated execution
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

@Injectable()
export class InvadeActionHandler implements ActionHandler {
  private readonly logger = new Logger(InvadeActionHandler.name);

  constructor(
    @InjectRepository(Province)
    private readonly provinceRepo: Repository<Province>,
  ) {}

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing INVADE action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    const fromId = action.actionData?.from_province_id as string | undefined;
    const toId = action.actionData?.to_province_id as string | undefined;
    const troopsNumber = Number(action.actionData?.troops_number ?? 0);

    if (!fromId || !toId) {
      throw new Error('from_province_id and to_province_id are required');
    }
    if (!Number.isFinite(troopsNumber) || troopsNumber <= 0) {
      throw new Error('troops_number must be a positive number');
    }

    await this.provinceRepo.manager.transaction(async (manager) => {
      const fromProvince = await manager.findOne(Province, {
        where: { id: fromId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromProvince) {
        throw new Error('Source province not found');
      }

      if (fromProvince.user_id !== action.userId) {
        throw new Error('User do not own the source province');
      }

      const fromTroops = Number(fromProvince.local_troops ?? 0);
      if (!Number.isFinite(fromTroops) || fromTroops < troopsNumber) {
        throw new Error('Not enough troops in the source province');
      }

      const toProvince = await manager.findOne(Province, {
        where: { id: toId },
        relations: ['buildings'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!toProvince) {
        throw new Error('Target province not found');
      }

      const defenderTroops = Number(toProvince.local_troops ?? 0);
      if (!Number.isFinite(defenderTroops)) {
        throw new Error('Invalid defender troop count on target province');
      }

      if (action.userId != null && action.userId !== action.userId) {
        throw new Error('actionData.userId does not match action user');
      }
      if (
        toProvince.user_id != null &&
        action.userId === toProvince.user_id
      ) {
        fromProvince.local_troops = fromTroops - troopsNumber;
        toProvince.local_troops = defenderTroops + troopsNumber;
        await manager.save(Province, [fromProvince, toProvince]);
        return;
      }

      const buildModifier = computeBuildModifier(toProvince.buildings);
      const battleResult = troopsNumber / buildModifier - defenderTroops;

      fromProvince.local_troops = fromTroops - troopsNumber;

      if (battleResult > 0) {
        const isWater = toProvince.type?.toLowerCase() === 'water';
        if (!isWater) {
          toProvince.user_id = action.userId;
        }
        toProvince.local_troops = Math.round(battleResult);
      } else if (battleResult < 0) {
        toProvince.local_troops = Math.round(-battleResult);
      } else {
        toProvince.local_troops = 0;
      }

      await manager.save(Province, [fromProvince, toProvince]);
    });
  }
}

@Injectable()
export class DeployActionHandler implements ActionHandler {
  private readonly logger = new Logger(DeployActionHandler.name);

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing DEPLOY action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    // TODO: Implement actual DEPLOY logic

    // Simulated execution
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

@Injectable()
export class UpgradeActionHandler implements ActionHandler {
  private readonly logger = new Logger(UpgradeActionHandler.name);

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing UPGRADE action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    // TODO: Implement actual upgrade logic

    // Simulated execution
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

@Injectable()
export class TransferTroopsActionHandler implements ActionHandler {
  private readonly logger = new Logger(TransferTroopsActionHandler.name);

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing TRANSFER_TROOPS action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    // TODO: Implement actual troop transfer logic

    // Simulated execution
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

@Injectable()
export class ActionExecutorService {
  private readonly logger = new Logger(ActionExecutorService.name);
  private handlers = new Map<ActionType, ActionHandler>();

  constructor(
    private buildHandler: BuildActionHandler,
    private invadeHandler: InvadeActionHandler,
    private deployHandler: DeployActionHandler,
    private upgradeHandler: UpgradeActionHandler,
    private transferTroopsHandler: TransferTroopsActionHandler,
  ) {
    this.handlers.set(ActionType.BUILD, buildHandler);
    this.handlers.set(ActionType.INVADE, invadeHandler);
    this.handlers.set(ActionType.DEPLOY, deployHandler);
    this.handlers.set(ActionType.UPGRADE, upgradeHandler);
    this.handlers.set(ActionType.TRANSFER_TROOPS, transferTroopsHandler);
  }

  async executeAction(action: ActionQueue): Promise<{
    success: boolean;
    error?: string;
  }> {
    const handler = this.handlers.get(action.actionType);

    if (!handler) {
      const error = `No handler found for action type: ${action.actionType}`;
      this.logger.error(error);
      return { success: false, error };
    }

    try {
      await handler.handle(action);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to execute action ${action.id}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { success: false, error: errorMessage };
    }
  }
}
