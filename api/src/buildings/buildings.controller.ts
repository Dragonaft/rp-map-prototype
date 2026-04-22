import { ClassSerializerInterceptor, Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@UseInterceptors(ClassSerializerInterceptor)
@Controller('buildings')
@UseGuards(JwtAuthGuard)
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  findAll() {
    return this.buildingsService.findAll();
  }
}
