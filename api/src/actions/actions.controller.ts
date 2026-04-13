import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionQueue } from './entities/action-queue.entity';
import { ActionsLog } from './entities/actions-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('actions')
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  private parsePositiveIntOrDefault(value: unknown, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException('Query params limit/offset must be non-negative integers');
    }
    return parsed;
  }

  @Post()
  async createAction(
    @Request() req,
    @Body() createActionDto: any,
  ): Promise<any> {
    return await this.actionsService.createAction(
      req.user.id,
      createActionDto.type,
      createActionDto.actionData,
    );
  }

  @Get()
  async getUserActions(@Request() req): Promise<ActionQueue[]> {
    return await this.actionsService.getUserActions(req.user.id);
  }

  @Get('pending')
  async getUserPendingActions(@Request() req): Promise<ActionQueue[]> {
    return await this.actionsService.getUserPendingActions(req.user.id);
  }

  @Delete('pending/:id')
  async retractAction(
    @Request() req,
    @Param('id') actionId: string,
  ): Promise<any> {
    return await this.actionsService.retractAction(req.user.id, actionId);
  }

  @Get('logs')
  async getAllLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ logs: ActionsLog[]; total: number }> {
    return await this.actionsService.getAllLogs(
      this.parsePositiveIntOrDefault(limit, 50),
      this.parsePositiveIntOrDefault(offset, 0),
    );
  }

  @Get('logs/my-actions')
  async getMyActionsFromLogs(
    @Request() req,
    @Query('limit') limit?: string,
  ): Promise<{ logs: any[]; total: number }> {
    return await this.actionsService.getUserActionsFromLogs(
      req.user.id,
      this.parsePositiveIntOrDefault(limit, 50),
    );
  }

  @Get('logs/timetable/:timetable')
  async getLogsByTimetable(
    @Param('timetable') timetable: string,
  ): Promise<ActionsLog[]> {
    return await this.actionsService.getLogsByTimetable(timetable);
  }

  @Get('logs/:id')
  async getLogById(@Param('id', ParseIntPipe) id: number): Promise<ActionsLog> {
    return await this.actionsService.getLogById(id);
  }
}
