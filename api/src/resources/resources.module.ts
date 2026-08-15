import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resource } from './entities/resource.entity';
import { UserResource } from './entities/user-resource.entity';
import { User } from '../users/entities/user.entity';
import { ResourcesService } from './resources.service';
import { UserResourcesService } from './user-resources.service';
import { ResourcesController } from './resources.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Resource, UserResource, User])],
  controllers: [ResourcesController],
  providers: [ResourcesService, UserResourcesService],
  exports: [ResourcesService, UserResourcesService],
})
export class ResourcesModule {}
