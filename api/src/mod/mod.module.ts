import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Province } from '../provinces/entities/province.entity';
import { Building } from '../buildings/entities/building.entity';
import { ProvinceBuilding } from '../buildings/entities/province-building.entity';
import { Army } from '../armies/entities/army.entity';
import { ArmyUnit } from '../armies/entities/army-unit.entity';
import { TroopType } from '../armies/entities/troop-type.entity';
import { GoodsModule } from '../goods/goods.module';
import { ResourcesModule } from '../resources/resources.module';
import { DiplomacyModule } from '../diplomacy/diplomacy.module';
import { UsersModule } from '../users/users.module';
import { ModService } from './mod.service';
import { ModController } from './mod.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Province, Building, ProvinceBuilding, Army, ArmyUnit, TroopType]),
    GoodsModule,
    ResourcesModule,
    DiplomacyModule,
    UsersModule,
  ],
  controllers: [ModController],
  providers: [ModService],
})
export class ModModule {}
