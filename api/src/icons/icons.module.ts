import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameIcon } from './entities/game-icon.entity';
import { IconsService } from './icons.service';
import { IconsController } from './icons.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GameIcon])],
  controllers: [IconsController],
  providers: [IconsService],
  exports: [IconsService],
})
export class IconsModule {}
