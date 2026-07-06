import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Good } from './entities/good.entity';
import { UserGood } from './entities/user-good.entity';
import { User } from '../users/entities/user.entity';
import { GoodsService } from './goods.service';
import { UserGoodsService } from './user-goods.service';
import { GoodsController } from './goods.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Good, UserGood, User])],
  controllers: [GoodsController],
  providers: [GoodsService, UserGoodsService],
  exports: [GoodsService, UserGoodsService],
})
export class GoodsModule {}
