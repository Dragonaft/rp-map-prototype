import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tech } from './entities/tech.entity';
import { TechsService } from './techs.service';
import { TechsController } from './techs.controller';
import { User } from "../users/entities/user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Tech, User])],
  controllers: [TechsController],
  providers: [TechsService],
  exports: [TechsService],
})
export class TechsModule {}
