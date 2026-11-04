import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateNotificationDto,
  NotificationQueryDto,
  RegisterDeviceTokenDto,
} from './dto/notifications.dto';
import { DevicePlatform, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a durable persisted notification for a recipient user.
   */
  async createNotification(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        actorId: dto.actorId,
        type: dto.type ?? NotificationType.SYSTEM,
        title: dto.title,
        titleAr: dto.titleAr,
        body: dto.body,
        bodyAr: dto.bodyAr,
        dataJson: dto.dataJson ?? {},
        read: false,
      },
    });
  }

  /**
   * Retrieves paginated notifications for the current authenticated user
   * along with the current unread count.
   */
  async findForUser(userId: string, query: NotificationQueryDto = {}) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const where: any = { userId };

    if (query.unreadOnly) {
      where.read = false;
    }

    const [notifications, unreadCount, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({
        where: { userId, read: false },
      }),
      this.prisma.notification.count({
        where: { userId },
      }),
    ]);

    return {
      notifications,
      unreadCount,
      total,
      limit,
      offset,
    };
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!existing) {
      throw new NotFoundException(`Notification ${notificationId} not found.`);
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return {
      markedCount: result.count,
      unreadCount: 0,
    };
  }

  /**
   * Registers or updates a device push token for mobile/web push notifications.
   */
  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: {
        userId,
        platform: dto.platform ?? DevicePlatform.IOS,
        updatedAt: new Date(),
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform ?? DevicePlatform.IOS,
      },
    });
  }

  /**
   * Retrieves registered push tokens for a user.
   */
  async getDeviceTokens(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true, platform: true, updatedAt: true },
    });
  }
}
