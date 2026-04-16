import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { TechsService } from './techs.service';
import { Tech } from './entities/tech.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('techs')
@UseGuards(JwtAuthGuard)
export class TechsController {
  constructor(private readonly techsService: TechsService) {}

  @Get()
  async getAvailableForUser(@Request() req): Promise<Tech[]> {
    return this.techsService.getAvailableForUser(req.user.class ?? null);
  }
}
