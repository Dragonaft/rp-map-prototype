import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArmiesController } from './armies.controller';
import { ArmiesService } from './armies.service';
import { Army } from './entities/army.entity';
import { ArmyUnit } from './entities/army-unit.entity';
import { TroopType } from './entities/troop-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Army, ArmyUnit, TroopType])],
  controllers: [ArmiesController],
  providers: [ArmiesService],
  exports: [ArmiesService, TypeOrmModule],
})
export class ArmiesModule {}
