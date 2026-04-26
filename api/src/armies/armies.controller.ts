import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ArmiesService } from './armies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('armies')
@UseGuards(JwtAuthGuard)
export class ArmiesController {
  constructor(private readonly armiesService: ArmiesService) {}

  @Get()
  getUserArmies(@Request() req) {
    return this.armiesService.getUserArmies(req.user.id);
  }

  @Get('troop-types')
  getTroopTypes() {
    return this.armiesService.getTroopTypes();
  }
}
