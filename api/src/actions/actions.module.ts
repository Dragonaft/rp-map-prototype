import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { ActionSchedulerService } from './action-scheduler.service';
import {
  ActionExecutorService,
  BuildActionHandler,
  InvadeActionHandler,
  RecruitActionHandler,
  UpgradeActionHandler,
  TransferTroopsActionHandler,
} from './action-executor.service';
import { ActionQueue } from './entities/action-queue.entity';
import { ActionsLog } from './entities/actions-log.entity';
import { ExecutionLock } from './entities/execution-lock.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ActionQueue, ActionsLog, ExecutionLock]),
  ],
  controllers: [ActionsController],
  providers: [
    ActionsService,
    ActionSchedulerService,
    ActionExecutorService,
    BuildActionHandler,
    InvadeActionHandler,
    RecruitActionHandler,
    UpgradeActionHandler,
    TransferTroopsActionHandler,
  ],
  exports: [ActionsService],
})
export class ActionsModule {}
