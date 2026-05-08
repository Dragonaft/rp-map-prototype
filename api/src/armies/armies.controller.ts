import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
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

  @Get('all')
  getAllArmies(@Request() req) {
    return this.armiesService.getAllArmies(req.user.id);
  }

  @Get('troop-types')
  getTroopTypes(@Request() req) {
    return this.armiesService.getTroopTypes(req.user.id);
  }

  @Post()
  createArmy(
    @Request() req,
    @Body() body: { province_id: string; name?: string; units: { troop_type_key: string; count: number }[] },
  ) {
    return this.armiesService.createArmyAction(req.user.id, body);
  }

  @Patch(':id')
  updateArmyName(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { name: string },
  ) {
    return this.armiesService.updateArmyName(id, req.user.id, body.name);
  }

  @Delete(':id')
  disbandArmy(@Param('id') id: string, @Request() req) {
    return this.armiesService.disbandArmyAction(id, req.user.id);
  }
}
