import { Controller, Get, UseGuards } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller('buildings')
@UseGuards(JwtAuthGuard)
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  findAll() {
    return this.buildingsService.findAll();
  }
}
