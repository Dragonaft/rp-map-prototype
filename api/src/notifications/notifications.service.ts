import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationSeverity, NotificationType } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async createForUser(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    severity: NotificationSeverity = NotificationSeverity.INFO,
  ): Promise<Notification> {
    return this.notificationRepo.save(
      this.notificationRepo.create({ user_id: userId, type, title, message, severity }),
    );
  }

  async broadcastToAll(
    title: string,
    message: string,
    severity: NotificationSeverity = NotificationSeverity.INFO,
  ): Promise<number> {
    const users = await this.userRepo.find({ select: ['id'] });
    if (!users.length) return 0;
    const rows = users.map((u) =>
      this.notificationRepo.create({
        user_id: u.id,
        type: NotificationType.ADMIN,
        title,
        message,
        severity,
      }),
    );
    await this.notificationRepo.save(rows);
    return rows.length;
  }

  async getMine(userId: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { user_id: userId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async markAllRead(userId: string, type?: NotificationType): Promise<void> {
    await this.notificationRepo.update(
      { user_id: userId, is_read: false, ...(type ? { type } : {}) },
      { is_read: true },
    );
  }
}
