import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Good } from './entities/good.entity';
import { GoodsService } from './goods.service';
import { GoodsController } from './goods.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Good])],
  controllers: [GoodsController],
  providers: [GoodsService],
  exports: [GoodsService],
})
export class GoodsModule {}
