import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiplomacyService } from './diplomacy.service';
import { TreatyService } from './treaty.service';
import { ProposeTreatyDto } from './dto/propose-treaty.dto';
import { DeclareWarDto } from './dto/declare-war.dto';
import { SendMoneyDto } from './dto/send-money.dto';

@Controller('diplomacy')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class DiplomacyController {
  constructor(
    private readonly diplomacyService: DiplomacyService,
    private readonly treatyService: TreatyService,
  ) {}

  /** Wraps a service call in a transaction and converts any thrown Error into a 400. */
  private async run<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    try {
      return await this.treatyService.defaultManager.transaction(fn);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Request failed');
    }
  }

  @Get('relations')
  async getRelations(@Request() req) {
    return this.diplomacyService.getRelationsForUser(req.user.id);
  }

  @Get('wars')
  async getWars(@Request() req) {
    return this.diplomacyService.getWarsForUser(this.diplomacyService.defaultManager, req.user.id);
  }

  @Get('treaties')
  async getTreaties(@Request() req) {
    return this.treatyService.getMyTreaties(req.user.id);
  }

  @Get('treaties/public/:userId')
  async getPublicTreaties(@Param('userId') userId: string) {
    return this.treatyService.getPublicTreaties(userId);
  }

  @Post('declare-war')
  async declareWar(@Request() req, @Body() dto: DeclareWarDto) {
    await this.run((manager) => this.treatyService.declareWar(manager, req.user.id, dto.targetUserId));
    return { success: true };
  }

  @Post('send-money')
  async sendMoney(@Request() req, @Body() dto: SendMoneyDto) {
    await this.run((manager) => this.treatyService.sendMoney(manager, req.user.id, dto.targetUserId, dto.amount));
    return { success: true };
  }

  @Post('treaties')
  async proposeTreaty(@Request() req, @Body() dto: ProposeTreatyDto) {
    return this.run((manager) => this.treatyService.proposeTreaty(manager, req.user.id, dto));
  }

  @Post('treaties/:id/accept')
  async acceptTreaty(@Request() req, @Param('id') id: string) {
    return this.run((manager) => this.treatyService.acceptTreaty(manager, req.user.id, id));
  }

  @Post('treaties/:id/reject')
  async rejectTreaty(@Request() req, @Param('id') id: string) {
    return this.run((manager) => this.treatyService.rejectTreaty(manager, req.user.id, id));
  }

  @Delete('treaties/:id')
  async cancelProposal(@Request() req, @Param('id') id: string) {
    return this.run((manager) => this.treatyService.cancelPendingProposal(manager, req.user.id, id));
  }

  @Post('treaties/:id/cancel-signed')
  async cancelSignedTreaty(@Request() req, @Param('id') id: string) {
    return this.run((manager) => this.treatyService.cancelSignedTreaty(manager, req.user.id, id));
  }
}
