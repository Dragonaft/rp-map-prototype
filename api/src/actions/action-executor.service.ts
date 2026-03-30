import { Injectable, Logger } from '@nestjs/common';
import { ActionQueue, ActionStatus, ActionType } from './entities/action-queue.entity';

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

  async handle(action: ActionQueue): Promise<void> {
    this.logger.log(
      `Executing INVADE action for user ${action.userId}: ${JSON.stringify(action.actionData)}`,
    );

    // TODO: Implement actual invasion logic
    // Example:
    // - Validate user has troops
    // - Calculate battle outcome
    // - Update province ownership
    // - Update troop counts

    // Simulated execution
    await new Promise((resolve) => setTimeout(resolve, 100));
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
