import { NotificationsService } from './notifications.service';
import { NotificationType, DevicePlatform } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      deviceToken: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new NotificationsService(prisma);
  });

  it('creates a durable notification', async () => {
    const mockCreated = {
      id: 'notif-1',
      userId: 'user-1',
      title: 'Leave Approved',
      body: 'Your leave request has been approved.',
      type: NotificationType.LEAVE_APPROVAL,
      read: false,
    };
    prisma.notification.create.mockResolvedValueOnce(mockCreated);

    const result = await service.createNotification({
      userId: 'user-1',
      title: 'Leave Approved',
      body: 'Your leave request has been approved.',
      type: NotificationType.LEAVE_APPROVAL,
    });

    expect(result).toEqual(mockCreated);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        title: 'Leave Approved',
        read: false,
      }),
    });
  });

  it('retrieves user notifications and unread count', async () => {
    const mockItems = [{ id: 'notif-1', read: false }, { id: 'notif-2', read: true }];
    prisma.notification.findMany.mockResolvedValueOnce(mockItems);
    prisma.notification.count
      .mockResolvedValueOnce(1) // unread count
      .mockResolvedValueOnce(2); // total count

    const result = await service.findForUser('user-1', { limit: 10, offset: 0 });

    expect(result.notifications).toEqual(mockItems);
    expect(result.unreadCount).toBe(1);
    expect(result.total).toBe(2);
  });

  it('marks a notification as read', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce({ id: 'notif-1', userId: 'user-1' });
    prisma.notification.update.mockResolvedValueOnce({ id: 'notif-1', read: true });

    const result = await service.markAsRead('user-1', 'notif-1');

    expect(result.read).toBe(true);
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: expect.objectContaining({ read: true }),
    });
  });

  it('marks all unread notifications as read', async () => {
    prisma.notification.updateMany.mockResolvedValueOnce({ count: 5 });

    const result = await service.markAllAsRead('user-1');

    expect(result.markedCount).toBe(5);
    expect(result.unreadCount).toBe(0);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', read: false },
      data: expect.objectContaining({ read: true }),
    });
  });

  it('registers a device push token', async () => {
    const mockToken = { id: 'tok-1', userId: 'user-1', token: 'expo-token-123', platform: DevicePlatform.IOS };
    prisma.deviceToken.upsert.mockResolvedValueOnce(mockToken);

    const result = await service.registerDeviceToken('user-1', {
      token: 'expo-token-123',
      platform: DevicePlatform.IOS,
    });

    expect(result).toEqual(mockToken);
    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith({
      where: { token: 'expo-token-123' },
      update: expect.objectContaining({ userId: 'user-1' }),
      create: expect.objectContaining({ userId: 'user-1', token: 'expo-token-123' }),
    });
  });
});
