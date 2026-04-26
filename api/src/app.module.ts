import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BuildingsModule } from './buildings/buildings.module';
import { ProvincesModule } from './provinces/provinces.module';
import { UsersModule } from './users/users.module';
import { ActionsModule } from './actions/actions.module';
import { TechsModule } from './techs/techs.module';
import { ArmiesModule } from './armies/armies.module';
import { Province } from './provinces/entities/province.entity';
import { User } from './users/entities/user.entity';
import { Building } from './buildings/entities/building.entity';
import { ActionQueue } from './actions/entities/action-queue.entity';
import { ActionsLog } from './actions/entities/actions-log.entity';
import { ExecutionLock } from './actions/entities/execution-lock.entity';
import { Tech } from './techs/entities/tech.entity';
import { Army } from './armies/entities/army.entity';
import { ArmyUnit } from './armies/entities/army-unit.entity';
import { TroopType } from './armies/entities/troop-type.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USER_NAME,
      password: process.env.DB_USER_PASSWORD,
      database: process.env.DB_NAME,
      entities: [
        Province, User, Building, ActionQueue, ActionsLog, ExecutionLock, Tech,
        Army, ArmyUnit, TroopType,
      ],
      synchronize: false,
    }),
    AuthModule,
    UsersModule,
    ProvincesModule,
    BuildingsModule,
    ActionsModule,
    TechsModule,
    ArmiesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
