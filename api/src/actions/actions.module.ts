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
  InvadeActionHandler,
  DeployActionHandler,
  UpgradeActionHandler,
  TransferTroopsActionHandler,
  ResearchActionHandler,
  RemoveActionHandler,
} from './action-executor.service';
import { ActionQueue } from './entities/action-queue.entity';
import { ActionsLog } from './entities/actions-log.entity';
import { ExecutionLock } from './entities/execution-lock.entity';
import { Province } from '../provinces/entities/province.entity';
import { User } from '../users/entities/user.entity';
import { UpkeepActionService } from './upkeep-action.service';
import { IncomeActionService } from './income-action.service';
import { UserStateLoaderService } from './user-state-loader.service';
import { TechsModule } from '../techs/techs.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ActionQueue, ActionsLog, ExecutionLock, Province, User]),
    TechsModule,
  ],
  controllers: [ActionsController, ActionExecutionStatusController],
  providers: [
    ActionExecutionStateService,
    ActionExecutionBlockMiddleware,
    ActionsService,
    ActionSchedulerService,
    IncomeActionService,
    UpkeepActionService,
    UserStateLoaderService,
    ActionExecutorService,
    BuildActionHandler,
    InvadeActionHandler,
    DeployActionHandler,
    UpgradeActionHandler,
    TransferTroopsActionHandler,
    ResearchActionHandler,
    RemoveActionHandler,
  ],
  exports: [ActionsService, ActionExecutionStateService, ActionExecutionBlockMiddleware],
})
export class ActionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ActionExecutionBlockMiddleware).forRoutes('*');
  }
}
