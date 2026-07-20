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
import { AdminModule } from './admin/admin.module';
import { ResourcesModule } from './resources/resources.module';
import { GoodsModule } from './goods/goods.module';
import { DiplomacyModule } from './diplomacy/diplomacy.module';
import { NotificationsModule } from './notifications/notifications.module';
import { Province } from './provinces/entities/province.entity';
import { User } from './users/entities/user.entity';
import { Building } from './buildings/entities/building.entity';
import { ProvinceBuilding } from './buildings/entities/province-building.entity';
import { ActionQueue } from './actions/entities/action-queue.entity';
import { ActionsLog } from './actions/entities/actions-log.entity';
import { ExecutionLock } from './actions/entities/execution-lock.entity';
import { Tech } from './techs/entities/tech.entity';
import { UserTechProgress } from './techs/entities/user-tech-progress.entity';
import { Army } from './armies/entities/army.entity';
import { ArmyUnit } from './armies/entities/army-unit.entity';
import { TroopType } from './armies/entities/troop-type.entity';
import { Resource } from './resources/entities/resource.entity';
import { Good } from './goods/entities/good.entity';
import { UserGood } from './goods/entities/user-good.entity';
import { UserResource } from './resources/entities/user-resource.entity';
import { DiplomaticRelation } from './diplomacy/entities/diplomatic-relation.entity';
import { War } from './diplomacy/entities/war.entity';
import { WarParticipant } from './diplomacy/entities/war-participant.entity';
import { Treaty } from './diplomacy/entities/treaty.entity';
import { Notification } from './notifications/entities/notification.entity';
import { NewsModule } from './news/news.module';
import { ModModule } from './mod/mod.module';
import { NewsAgency } from './news/entities/news-agency.entity';
import { NewsArticle } from './news/entities/news-article.entity';
import { ClassesModule } from './classes/classes.module';
import { PlayerClass } from './classes/entities/player-class.entity';

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
        Province, User, Building, ProvinceBuilding, ActionQueue, ActionsLog, ExecutionLock, Tech,
        UserTechProgress,
        Army, ArmyUnit, TroopType, Resource, Good, UserGood, UserResource,
        DiplomaticRelation, War, WarParticipant, Treaty,
        Notification,
        NewsAgency, NewsArticle,
        PlayerClass,
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
    AdminModule,
    ResourcesModule,
    GoodsModule,
    DiplomacyModule,
    NotificationsModule,
    NewsModule,
    ModModule,
    ClassesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
