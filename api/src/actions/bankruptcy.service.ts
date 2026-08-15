import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Army } from '../armies/entities/army.entity';
import { TreatyService } from '../diplomacy/treaty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationSeverity, NotificationType } from '../notifications/entities/notification.entity';

export const BANKRUPTCY_TRIGGER_TURNS = 4;
export const BANKRUPTCY_DEBUFF_TURNS = 6;

/**
 * Runs once per turn, after every phase that can move money (income, upkeep, recurring trade,
 * queued actions) has settled. Tracks consecutive negative-money turns per user and, once the
 * threshold is passed, declares bankruptcy: armies disbanded, money reset to 0, outgoing recurring
 * money trades cancelled, and a BANKRUPTCY_DEBUFF_TURNS-turn combat/production penalty begins.
 */
@Injectable()
export class BankruptcyService {
  private readonly logger = new Logger(BankruptcyService.name);

  constructor(
    private readonly treatyService: TreatyService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async tick(manager: EntityManager): Promise<void> {
    const users = await manager.find(User);

    for (const user of users) {
      const money = Number(user.money ?? 0);

      // Decrement first so a bankruptcy triggered *this* turn (below) always resets to the full duration.
      if (user.bankruptcy_debuff_turns > 0) {
        user.bankruptcy_debuff_turns -= 1;
      }

      if (money < 0) {
        user.negative_money_turns = (user.negative_money_turns ?? 0) + 1;
      } else {
        user.negative_money_turns = 0;
      }

      if (user.negative_money_turns > BANKRUPTCY_TRIGGER_TURNS) {
        await this.triggerBankruptcy(manager, user);
      } else if (user.negative_money_turns > 0) {
        const turnsLeft = BANKRUPTCY_TRIGGER_TURNS + 1 - user.negative_money_turns;
        await this.notifyWarning(user.id, turnsLeft);
      }

      await manager.update(User, { id: user.id }, {
        money: user.money,
        negative_money_turns: user.negative_money_turns,
        bankruptcy_debuff_turns: user.bankruptcy_debuff_turns,
      });
    }
  }

  private async triggerBankruptcy(manager: EntityManager, user: User): Promise<void> {
    // ArmyUnit has an onDelete: 'CASCADE' FK to Army, so deleting the armies is enough.
    const armies = await manager.find(Army, { where: { user_id: user.id } });
    await manager.delete(Army, { user_id: user.id });

    user.money = 0;
    user.negative_money_turns = 0;
    user.bankruptcy_debuff_turns = BANKRUPTCY_DEBUFF_TURNS;

    const cancelledTrades = await this.treatyService.cancelOutgoingRecurringMoneyTrades(manager, user.id);

    this.logger.warn(
      `User ${user.id} declared bankrupt: ${armies.length} army(ies) disbanded, ${cancelledTrades} recurring money trade(s) cancelled`,
    );

    await this.notificationsService.createForUser(
      user.id,
      NotificationType.SYSTEM,
      'Bankruptcy Declared',
      `Your treasury stayed negative for too long. All of your armies have been disbanded, your money has been reset to 0, and any recurring trades where you send money have been cancelled. For the next ${BANKRUPTCY_DEBUFF_TURNS} turns your combat power is reduced by 50% and your buildings will not produce goods or resources.`,
      NotificationSeverity.ERROR,
    );
  }

  private async notifyWarning(userId: string, turnsLeft: number): Promise<void> {
    await this.notificationsService.createForUser(
      userId,
      NotificationType.SYSTEM,
      'Bankruptcy Risk',
      `Your treasury is negative. You have ${turnsLeft} more turn(s) before bankruptcy hits. If it does: all armies will be disbanded, your money will reset to 0, recurring trades where you send money will be cancelled, and for ${BANKRUPTCY_DEBUFF_TURNS} turns afterward your combat power will be reduced by 50% and your buildings will stop producing goods and resources.`,
      NotificationSeverity.WARNING,
    );
  }
}
