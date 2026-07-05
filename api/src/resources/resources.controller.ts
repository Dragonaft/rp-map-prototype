import { ClassSerializerInterceptor, Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { Resource } from './entities/resource.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('resources')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  async getAll(): Promise<Resource[]> {
    return this.resourcesService.getAll();
  }
}
