import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Army } from '../armies/entities/army.entity';
import { GoodsModule } from '../goods/goods.module';
import { ResourcesModule } from '../resources/resources.module';
import { TechsModule } from '../techs/techs.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Army]), GoodsModule, ResourcesModule, TechsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
