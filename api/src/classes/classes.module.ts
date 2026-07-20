import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerClass } from './entities/player-class.entity';
import { ClassesService } from './classes.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlayerClass])],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
