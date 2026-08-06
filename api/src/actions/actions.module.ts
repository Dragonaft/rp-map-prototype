import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ActionsController } from './actions.controller';
import { ActionExecutionStatusController } from './action-execution-status.controller';
import { ActionExecutionBlockMiddleware } from './action-execution-block.middleware';
import { ActionExecutionStateService } from './action-execution-state.service';
import { ActionsService } from './actions.service';
import { ActionSchedulerService } from './action-scheduler.service';
import {
  ActionExecutorService,
  BuildActionHandler,
  UpgradeActionHandler,
  RemoveActionHandler,
  ArmyCreateHandler,
  ArmyRecruitHandler,
  ArmyMoveHandler,
  ArmyMergeHandler,
  ArmyTransferHandler,
  ArmyDisbandHandler,
  ArmyEditHandler,
  ColonizeActionHandler,
} from './action-executor.service';
import { ActionQueue } from './entities/action-queue.entity';
import { ActionsLog } from './entities/actions-log.entity';
import { ExecutionLock } from './entities/execution-lock.entity';
import { Province } from '../provinces/entities/province.entity';
import { User } from '../users/entities/user.entity';
import { Army } from '../armies/entities/army.entity';
import { ArmyUnit } from '../armies/entities/army-unit.entity';
import { TroopType } from '../armies/entities/troop-type.entity';
import { UpkeepActionService } from './upkeep-action.service';
import { IncomeActionService } from './income-action.service';
import { ProductionActionService } from './production-action.service';
import { SupplyActionService } from './supply-action.service';
import { BankruptcyService } from './bankruptcy.service';
import { UserStateLoaderService } from './user-state-loader.service';
import { ProvinceBuilding } from '../buildings/entities/province-building.entity';
import { TechsModule } from '../techs/techs.module';
import { ResourcesModule } from '../resources/resources.module';
import { GoodsModule } from '../goods/goods.module';
import { DiplomacyModule } from '../diplomacy/diplomacy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GameSettingsModule } from '../settings/game-settings.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      ActionQueue, ActionsLog, ExecutionLock, Province, User,
      Army, ArmyUnit, TroopType, ProvinceBuilding,
    ]),
    TechsModule,
    ResourcesModule,
    GoodsModule,
    DiplomacyModule,
    NotificationsModule,
    GameSettingsModule,
  ],
  controllers: [ActionsController, ActionExecutionStatusController],
  providers: [
    ActionExecutionStateService,
    ActionExecutionBlockMiddleware,
    ActionsService,
    ActionSchedulerService,
    IncomeActionService,
    UpkeepActionService,
    ProductionActionService,
    SupplyActionService,
    BankruptcyService,
    UserStateLoaderService,
    ActionExecutorService,
    BuildActionHandler,
    UpgradeActionHandler,
    RemoveActionHandler,
    ArmyCreateHandler,
    ArmyRecruitHandler,
    ArmyMoveHandler,
    ArmyMergeHandler,
    ArmyTransferHandler,
    ArmyDisbandHandler,
    ArmyEditHandler,
    ColonizeActionHandler,
  ],
  exports: [ActionsService, ActionExecutionStateService, ActionExecutionBlockMiddleware],
})
export class ActionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ActionExecutionBlockMiddleware).forRoutes('*');
  }
}
