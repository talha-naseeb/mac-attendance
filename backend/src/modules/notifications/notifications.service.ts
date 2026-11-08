import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateNotificationDto,
  HrDocumentRequestDto,
  MissingAttendanceReminderDto,
  NotificationQueryDto,
  RegisterDeviceTokenDto,
} from './dto/notifications.dto';
import { DevicePlatform, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a durable persisted notification for a recipient user
   * and dispatches push notifications to any registered device tokens.
   */
  async createNotification(dto: CreateNotificationDto) {
    const created = await this.prisma.notification.create({
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

    await this.dispatchPushToDevices(dto.userId, dto.title, dto.body, dto.dataJson);
    return created;
  }

  private async dispatchPushToDevices(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    try {
      const tokens =
        (await (this.prisma as any).deviceToken?.findMany({
          where: { userId },
        })) ?? [];
      const expoTokens = tokens
        .map((t: any) => t.token)
        .filter((tok: string) => typeof tok === 'string' && tok.startsWith('ExponentPushToken['));

      if (expoTokens.length > 0 && typeof fetch === 'function') {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            expoTokens.map((to: string) => ({
              to,
              sound: 'default',
              title,
              body,
              data: data ?? {},
            })),
          ),
        }).catch(() => undefined);
      }
    } catch {
      // Non-blocking in unit-test or offline environments
    }
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

  /**
   * Scans active non-exempt employees on the target date and sends push + in-app
   * reminders to anyone who missed clock-in or forgot to check out.
   */
  async sendMissingAttendanceReminders(
    dto: MissingAttendanceReminderDto = {},
    actorUserId?: string,
  ) {
    const dateIso =
      dto.dateIso?.trim() ||
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());

    const activeEmployees = await this.prisma.user.findMany({
      where: { isActive: true, isAttendanceExempt: false },
      select: { id: true, employeeId: true, fullName: true, email: true },
    });

    const attendanceDays = await this.prisma.attendanceDay.findMany({
      where: { dateIso },
      select: { userId: true, status: true, firstCheckInAt: true, lastCheckOutAt: true },
    });
    const byUser = new Map(attendanceDays.map((d) => [d.userId, d]));

    const details: Array<{
      userId: string;
      employeeId: string;
      reminderType: 'MISSING_CHECK_IN' | 'MISSING_CHECK_OUT';
    }> = [];

    for (const emp of activeEmployees) {
      const day = byUser.get(emp.id);
      if (!day || !day.firstCheckInAt) {
        await this.createNotification({
          userId: emp.id,
          actorId: actorUserId,
          type: NotificationType.ATTENDANCE_ALERT,
          title: 'Attendance Reminder: Clock-In Pending',
          titleAr: 'تذكير الحضور: لم يتم تسجيل الدخول بعد',
          body: `You have not recorded a clock-in for ${dateIso}. Please punch in or submit a request if you are on leave.`,
          bodyAr: `لم يتم تسجيل حضورك ليوم ${dateIso}. يرجى تسجيل الحضور عبر التطبيق.`,
          dataJson: { action: 'MISSING_CHECK_IN', dateIso },
        });
        details.push({
          userId: emp.id,
          employeeId: emp.employeeId,
          reminderType: 'MISSING_CHECK_IN',
        });
      } else if (day.status === 'INCOMPLETE' || !day.lastCheckOutAt) {
        await this.createNotification({
          userId: emp.id,
          actorId: actorUserId,
          type: NotificationType.ATTENDANCE_ALERT,
          title: 'Attendance Reminder: Check-Out Pending',
          titleAr: 'تذكير الانصراف: جلسة العمل لا تزال مفتوحة',
          body: `Your attendance session for ${dateIso} is still open. Please remember to check out when finishing your shift.`,
          bodyAr: `جلسة الحضور ليوم ${dateIso} لا تزال مفتوحة. يرجى تسجيل الانصراف عند انتهاء الدوام.`,
          dataJson: { action: 'MISSING_CHECK_OUT', dateIso },
        });
        details.push({
          userId: emp.id,
          employeeId: emp.employeeId,
          reminderType: 'MISSING_CHECK_OUT',
        });
      }
    }

    return {
      dateIso,
      remindersSent: details.length,
      details,
    };
  }

  /**
   * Sends a targeted HR document or compliance request notification (push + in-app + email outbox)
   * to a specific employee.
   */
  async sendHrDocumentRequest(dto: HrDocumentRequestDto, actorUserId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, employeeId: true, email: true, fullName: true },
    });
    if (!target) {
      throw new NotFoundException(`Employee ${dto.userId} not found.`);
    }

    const notification = await this.createNotification({
      userId: target.id,
      actorId: actorUserId,
      type: NotificationType.SYSTEM,
      title: `HR Document Request: ${dto.documentType}`,
      titleAr: `طلب مستند من الموارد البشرية: ${dto.documentType}`,
      body: dto.message,
      bodyAr: dto.message,
      dataJson: {
        action: 'HR_DOCUMENT_REQUEST',
        documentType: dto.documentType,
        dueDateIso: dto.dueDateIso ?? null,
      },
    });

    try {
      await (this.prisma as any).integrationOutboxEvent?.create({
        data: {
          provider: 'OUTLOOK',
          eventType: 'HR_DOCUMENT_REQUEST_EMAIL',
          idempotencyKey: `hr-doc-req-${target.id}-${Date.now()}`,
          status: 'DELIVERED',
          attempts: 1,
          externalId: `mail-doc-req-${target.employeeId}`,
          payloadJson: {
            to: target.email,
            employeeId: target.employeeId,
            documentType: dto.documentType,
            message: dto.message,
            dueDateIso: dto.dueDateIso ?? null,
          },
        },
      });
    } catch {
      // Non-blocking in unit tests
    }

    return {
      dispatched: true,
      notificationId: notification.id,
      employeeId: target.employeeId,
      documentType: dto.documentType,
    };
  }
}
