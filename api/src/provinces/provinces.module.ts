import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvincesService } from './provinces.service';
import { ProvincesController } from './provinces.controller';
import { Province } from './entities/province.entity';
import { Building } from '../buildings/entities/building.entity';
import { User } from "../users/entities/user.entity";
import { ActionsModule } from '../actions/actions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Province, Building, User]),
    ActionsModule,
  ],
  controllers: [ProvincesController],
  providers: [ProvincesService],
})
export class ProvincesModule {}
