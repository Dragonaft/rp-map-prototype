import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiplomaticRelation } from './entities/diplomatic-relation.entity';
import { War } from './entities/war.entity';
import { WarParticipant } from './entities/war-participant.entity';
import { Treaty } from './entities/treaty.entity';
import { User } from '../users/entities/user.entity';
import { Province } from '../provinces/entities/province.entity';
import { Army } from '../armies/entities/army.entity';
import { ResourcesModule } from '../resources/resources.module';
import { GoodsModule } from '../goods/goods.module';
import { DiplomacyService } from './diplomacy.service';
import { OccupationService } from './occupation.service';
import { TreatyService } from './treaty.service';
import { DiplomacyController } from './diplomacy.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DiplomaticRelation, War, WarParticipant, Treaty, User, Province, Army]),
    ResourcesModule,
    GoodsModule,
  ],
  controllers: [DiplomacyController],
  providers: [DiplomacyService, OccupationService, TreatyService],
  exports: [DiplomacyService, OccupationService, TreatyService],
})
export class DiplomacyModule {}
