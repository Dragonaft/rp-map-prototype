import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tech } from './entities/tech.entity';
import { TechsService } from './techs.service';
import { TechsController } from './techs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tech])],
  controllers: [TechsController],
  providers: [TechsService],
  exports: [TechsService],
})
export class TechsModule {}
