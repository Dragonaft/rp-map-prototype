import { Controller, Get, Body, Patch, Param, ClassSerializerInterceptor, UseInterceptors, UseGuards, Request } from '@nestjs/common';
import { ProvincesService } from './provinces.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProvincesUpdateBodyRequest } from './requests/provinces-update-body.request';

@Controller('provinces')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ProvincesController {
  constructor(private readonly provincesService: ProvincesService) {}

  @Get()
  getAll(@Request() req) {
    return this.provincesService.getAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.provincesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProvinceDto: ProvincesUpdateBodyRequest) {
    return this.provincesService.update(id, updateProvinceDto);
  }

  @Patch('/setup/:id')
  setupStart(@Param('id') id: string, @Request() req) {
    return this.provincesService.setupStart(id, req.user);
  }
}
