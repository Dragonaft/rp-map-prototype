import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoles } from '../users/types/users.types';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoles.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Users ---

  @Get('users')
  getUsers() {
    return this.adminService.findAllUsers();
  }

  @Post('users')
  createUser(@Body() body: Record<string, any>) {
    return this.adminService.createUser(body);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateUser(id, body);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // --- Buildings ---

  @Get('buildings')
  getBuildings() {
    return this.adminService.findAllBuildings();
  }

  @Post('buildings')
  createBuilding(@Body() body: Record<string, any>) {
    return this.adminService.createBuilding(body);
  }

  @Patch('buildings/:id')
  updateBuilding(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateBuilding(id, body);
  }

  @Delete('buildings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBuilding(@Param('id') id: string) {
    return this.adminService.deleteBuilding(id);
  }

  // --- Armies ---

  @Get('armies')
  getArmies() {
    return this.adminService.findAllArmies();
  }

  @Post('armies')
  createArmy(@Body() body: Record<string, any>) {
    return this.adminService.createArmy(body);
  }

  @Patch('armies/:id')
  updateArmy(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateArmy(id, body);
  }

  @Delete('armies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteArmy(@Param('id') id: string) {
    return this.adminService.deleteArmy(id);
  }

  // --- Techs ---

  @Get('techs')
  getTechs() {
    return this.adminService.findAllTechs();
  }

  @Post('techs')
  createTech(@Body() body: Record<string, any>) {
    return this.adminService.createTech(body);
  }

  @Patch('techs/:id')
  updateTech(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateTech(id, body);
  }

  @Delete('techs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTech(@Param('id') id: string) {
    return this.adminService.deleteTech(id);
  }
}
