import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Building } from '../buildings/entities/building.entity';
import { Army } from '../armies/entities/army.entity';
import { Tech } from '../techs/entities/tech.entity';
import { TroopType } from '../armies/entities/troop-type.entity';
import { Resource } from '../resources/entities/resource.entity';
import { Good } from '../goods/entities/good.entity';
import { GoodsModule } from '../goods/goods.module';
import { ResourcesModule } from '../resources/resources.module';
import { DiplomaticRelation } from '../diplomacy/entities/diplomatic-relation.entity';
import { War } from '../diplomacy/entities/war.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { NewsAgency } from '../news/entities/news-agency.entity';
import { NewsArticle } from '../news/entities/news-article.entity';
import { TechsModule } from '../techs/techs.module';
import { UsersModule } from '../users/users.module';
import { PlayerClass } from '../classes/entities/player-class.entity';
import { GameSettingsModule } from '../settings/game-settings.module';
import { KnowledgeArticle } from '../knowledge/entities/knowledge-article.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Building, Army, Tech, TroopType, Resource, Good, DiplomaticRelation, War, NewsAgency, NewsArticle, PlayerClass, KnowledgeArticle]),
    GoodsModule,
    ResourcesModule,
    NotificationsModule,
    TechsModule,
    UsersModule,
    GameSettingsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
