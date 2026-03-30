import {
  Body,
  Controller,
  Delete,
  Get,
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

  @Post()
  async createAction(
    @Request() req,
    @Body() createActionDto: any,
  ): Promise<ActionQueue> {
    console.log(createActionDto, 'createActionDto_TEST')

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

  @Delete(':id')
  async retractAction(
    @Request() req,
    @Param('id') actionId: number,
  ): Promise<ActionQueue> {
    return await this.actionsService.retractAction(req.user.id, actionId);
  }

  @Get('logs')
  async getAllLogs(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<{ logs: ActionsLog[]; total: number }> {
    return await this.actionsService.getAllLogs(
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }

  @Get('logs/my-actions')
  async getMyActionsFromLogs(
    @Request() req,
    @Query('limit') limit?: number,
  ): Promise<{ logs: any[]; total: number }> {
    return await this.actionsService.getUserActionsFromLogs(
      req.user.id,
      limit ? Number(limit) : 50,
    );
  }

  @Get('logs/timetable/:timetable')
  async getLogsByTimetable(
    @Param('timetable') timetable: string,
  ): Promise<ActionsLog[]> {
    return await this.actionsService.getLogsByTimetable(timetable);
  }

  @Get('logs/:id')
  async getLogById(@Param('id') id: number): Promise<ActionsLog> {
    return await this.actionsService.getLogById(Number(id));
  }
}
