import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tech } from './entities/tech.entity';
import { UserTechProgress } from './entities/user-tech-progress.entity';
import { TechsService } from './techs.service';
import { TechsController } from './techs.controller';
import { TechEffectsService } from './tech-effects.service';
import { UserTechProgressService } from './user-tech-progress.service';
import { User } from "../users/entities/user.entity";
import { ClassesModule } from '../classes/classes.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tech, User, UserTechProgress]), ClassesModule],
  controllers: [TechsController],
  providers: [TechsService, TechEffectsService, UserTechProgressService],
  exports: [TechsService, TechEffectsService, UserTechProgressService],
})
export class TechsModule {}
