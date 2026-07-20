import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoles } from '../users/types/users.types';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoles.ADMIN, UserRoles.MODERATOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Users ---

  @Get('users')
  getUsers() {
    return this.adminService.findAllUsers();
  }

  @Post('users')
  createUser(@Request() req, @Body() body: Record<string, any>) {
    return this.adminService.createUser(body, req.user.role);
  }

  @Patch('users/:id')
  updateUser(@Request() req, @Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateUser(id, body, req.user.role);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@Request() req, @Param('id') id: string) {
    return this.adminService.deleteUser(id, req.user.role);
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

  // --- Troop Types ---

  @Get('troop-types')
  getTroopTypes() {
    return this.adminService.findAllTroopTypes();
  }

  @Post('troop-types')
  createTroopType(@Body() body: Record<string, any>) {
    return this.adminService.createTroopType(body);
  }

  @Patch('troop-types/:id')
  updateTroopType(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateTroopType(id, body);
  }

  @Delete('troop-types/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTroopType(@Param('id') id: string) {
    return this.adminService.deleteTroopType(id);
  }

  // --- Resources ---

  @Get('resources')
  getResources() {
    return this.adminService.findAllResources();
  }

  @Post('resources')
  createResource(@Body() body: Record<string, any>) {
    return this.adminService.createResource(body);
  }

  @Patch('resources/:id')
  updateResource(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateResource(id, body);
  }

  @Delete('resources/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteResource(@Param('id') id: string) {
    return this.adminService.deleteResource(id);
  }

  // --- Goods ---

  @Get('goods')
  getGoods() {
    return this.adminService.findAllGoods();
  }

  @Post('goods')
  createGood(@Body() body: Record<string, any>) {
    return this.adminService.createGood(body);
  }

  @Patch('goods/:id')
  updateGood(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateGood(id, body);
  }

  @Delete('goods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGood(@Param('id') id: string) {
    return this.adminService.deleteGood(id);
  }

  // --- Classes ---

  @Get('classes')
  getClasses() {
    return this.adminService.findAllClasses();
  }

  @Post('classes')
  createClass(@Body() body: Record<string, any>) {
    return this.adminService.createClass(body);
  }

  @Patch('classes/:id')
  updateClass(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateClass(id, body);
  }

  @Delete('classes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteClass(@Param('id') id: string) {
    return this.adminService.deleteClass(id);
  }

  // --- Diplomatic Relations ---

  @Get('diplomacy-relations')
  getDiplomaticRelations() {
    return this.adminService.findAllDiplomaticRelations();
  }

  @Post('diplomacy-relations')
  createDiplomaticRelation(@Body() body: Record<string, any>) {
    return this.adminService.createDiplomaticRelation(body);
  }

  @Patch('diplomacy-relations/:id')
  updateDiplomaticRelation(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateDiplomaticRelation(id, body);
  }

  @Delete('diplomacy-relations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDiplomaticRelation(@Param('id') id: string) {
    return this.adminService.deleteDiplomaticRelation(id);
  }

  // --- Wars ---

  @Get('wars')
  getWars() {
    return this.adminService.findAllWars();
  }

  @Post('wars')
  createWar(@Body() body: Record<string, any>) {
    return this.adminService.createWar(body);
  }

  @Patch('wars/:id')
  updateWar(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateWar(id, body);
  }

  @Delete('wars/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWar(@Param('id') id: string) {
    return this.adminService.deleteWar(id);
  }

  // --- Notifications ---

  @Post('notifications/broadcast')
  broadcastNotification(@Body() body: { title: string; message: string; severity?: string }) {
    return this.adminService.broadcastNotification(body.title, body.message, body.severity as any);
  }

  // --- News Wall ---

  @Get('news-agencies')
  getNewsAgencies() {
    return this.adminService.findAllNewsAgencies();
  }

  @Delete('news-agencies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteNewsAgency(@Param('id') id: string) {
    return this.adminService.deleteNewsAgency(id);
  }

  @Get('news-articles')
  getNewsArticles() {
    return this.adminService.findAllNewsArticles();
  }

  @Delete('news-articles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteNewsArticle(@Param('id') id: string) {
    return this.adminService.deleteNewsArticle(id);
  }
}
