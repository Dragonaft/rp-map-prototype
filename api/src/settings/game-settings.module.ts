import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSettings } from './entities/game-settings.entity';
import { GameSettingsService } from './game-settings.service';
import { GameSettingsController } from './game-settings.controller';
import { GamePauseInterceptor } from './interceptors/game-pause.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([GameSettings])],
  controllers: [GameSettingsController],
  providers: [
    GameSettingsService,
    { provide: APP_INTERCEPTOR, useClass: GamePauseInterceptor },
  ],
  exports: [GameSettingsService],
})
export class GameSettingsModule {}
