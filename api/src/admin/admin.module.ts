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

@Module({
  imports: [TypeOrmModule.forFeature([User, Building, Army, Tech, TroopType, Resource, Good]), GoodsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
