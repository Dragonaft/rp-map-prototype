import { Controller, Get, Post, Body, Patch, Param, ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';
import { ProvincesService } from './provinces.service';

@Controller('provinces')
@UseInterceptors(ClassSerializerInterceptor)
export class ProvincesController {
  constructor(private readonly provincesService: ProvincesService) {}

  @Post()
  create(@Body() createProvinceDto: any) {
    return this.provincesService.create(createProvinceDto);
  }

  @Get()
  getAll() {
    return this.provincesService.getAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.provincesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProvinceDto: any) {
    return this.provincesService.update(+id, updateProvinceDto);
  }
}
