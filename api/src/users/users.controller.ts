import {
  Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, UseInterceptors, ClassSerializerInterceptor,
  UseGuards
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersCreateBodyRequest } from "./requests/users-create-body.request";
import { UsersUpdateBodyRequest } from "./requests/users-update-body.request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller('users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() body: UsersCreateBodyRequest) {
    return this.usersService.create(body);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UsersUpdateBodyRequest) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
