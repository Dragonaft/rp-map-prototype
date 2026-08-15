import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from './entities/notification.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMine(@Request() req): Promise<Notification[]> {
    return this.notificationsService.getMine(req.user.id);
  }

  @Post('mark-read')
  async markAllRead(@Request() req, @Body() body: { type?: NotificationType }): Promise<{ success: true }> {
    await this.notificationsService.markAllRead(req.user.id, body?.type);
    return { success: true };
  }
}
