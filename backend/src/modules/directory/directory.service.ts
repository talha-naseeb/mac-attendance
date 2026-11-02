import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DirectoryService {
  constructor(private prisma: PrismaService) {}

  async getWhosOffToday() {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const activeLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endOfToday },
        endDate: { gte: startOfToday },
        // Deactivation rejects live requests but keeps approved history; an
        // inactive employee must not stay on the live Who's Off list.
        user: { isActive: true },
      },
      include: {
        user: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            department: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    return activeLeaves.map((l) => ({
      employee: l.user,
      leaveType: l.type,
      startDate: l.startDate,
      endDate: l.endDate,
      daysCount: l.daysCount,
    }));
  }

  async getDirectory() {
    const employees = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        department: true,
        avatarUrl: true,
        role: true,
        branch: {
          select: { name: true, nameAr: true, code: true },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    // Determine who has clocked in today
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const todayPunches = await this.prisma.attendanceRecord.findMany({
      where: {
        timestamp: { gte: startOfToday, lte: endOfToday },
      },
    });

    // Check who is on approved leave
    const whosOff = await this.getWhosOffToday();
    const offUserIds = new Set(whosOff.map((w) => w.employee.id));

    return employees.map((emp) => {
      let status = 'OFFLINE';
      if (offUserIds.has(emp.id)) {
        status = 'ON_LEAVE';
      } else {
        const empPunches = todayPunches.filter((p) => p.userId === emp.id);
        const checkIn = empPunches.find((p) => p.type === 'CHECK_IN');
        const checkOut = empPunches.reverse().find((p) => p.type === 'CHECK_OUT');

        if (checkIn && !checkOut) {
          status = 'PRESENT_ON_SITE';
        } else if (checkIn && checkOut) {
          status = 'CHECKED_OUT';
        }
      }

      return {
        ...emp,
        presenceStatus: status,
      };
    });
  }
}
