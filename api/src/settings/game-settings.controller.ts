import { ClassSerializerInterceptor, Controller, Get, UseInterceptors } from '@nestjs/common';
import { GameSettingsService } from './game-settings.service';

/**
 * Public — no auth guard. The login screen must be able to read pause state before
 * anyone is authenticated, and nothing exposed here (isPaused/pauseMessage/turnsEnabled)
 * is sensitive. Admin read/write goes through /admin/game-settings (AdminController)
 * instead, which is ADMIN-gated.
 */
@Controller('game-settings')
@UseInterceptors(ClassSerializerInterceptor)
export class GameSettingsController {
  constructor(private readonly gameSettingsService: GameSettingsService) {}

  @Get()
  async getPublic() {
    return this.gameSettingsService.get();
  }
}
