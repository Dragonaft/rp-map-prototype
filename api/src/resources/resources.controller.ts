import { ClassSerializerInterceptor, Controller, Get, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { UserResourcesService } from './user-resources.service';
import { Resource } from './entities/resource.entity';
import { UserResource } from './entities/user-resource.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('resources')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly userResourcesService: UserResourcesService,
  ) {}

  @Get()
  async getAll(): Promise<Resource[]> {
    return this.resourcesService.getAll();
  }

  @Get('mine')
  async getMine(@Request() req): Promise<UserResource[]> {
    return this.userResourcesService.getForUser(req.user.id);
  }
}
