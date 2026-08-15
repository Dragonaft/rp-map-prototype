import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ModService } from './mod.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoles } from '../users/types/users.types';

/** Instant god-mode tools for the MOD-switch-ON layer. See mod.service.ts for the rationale. */
@Controller('mod')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoles.ADMIN, UserRoles.MODERATOR)
export class ModController {
  constructor(private readonly modService: ModService) {}

  @Post('npc')
  createNpc(@Body() body: { login: string; country_name: string; color: string; money?: number; troops?: number; piety?: number }) {
    return this.modService.createNpc(body);
  }

  @Get('npcs')
  listNpcs() {
    return this.modService.listNpcs();
  }

  @Patch('province/:id/owner')
  setProvinceOwner(@Param('id') id: string, @Body() body: { userId: string | null }) {
    return this.modService.setProvinceOwner(id, body.userId ?? null);
  }

  @Post('army')
  spawnArmy(@Body() body: { userId: string; provinceId: string; name?: string; units: { troop_type_key: string; count: number }[] }) {
    return this.modService.spawnArmy(body);
  }

  @Post('building')
  placeBuilding(@Body() body: { provinceId: string; buildingId: string }) {
    return this.modService.placeBuilding(body.provinceId, body.buildingId);
  }

  @Delete('building/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBuilding(@Param('id') id: string) {
    return this.modService.removeBuilding(id);
  }

  @Patch('user/:id/stocks')
  setStocks(@Param('id') id: string, @Body() body: {
    money?: number; troops?: number; piety?: number;
    goods?: { goodId: string; quantity: number }[];
    resources?: { resourceKey: string; quantity: number }[];
  }) {
    return this.modService.setStocks(id, body);
  }
}
