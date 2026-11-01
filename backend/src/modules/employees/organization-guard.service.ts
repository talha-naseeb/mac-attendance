import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OrganizationGuardService {
  constructor(private prisma: PrismaService) {}

  async assertCanAssignManager(userId: string, managerId: string | null | undefined): Promise<void> {
    if (!managerId) return;
    if (managerId === userId) {
      throw new BadRequestException('An employee cannot be their own manager.');
    }

    const seen = new Set<string>();
    let current: string | null = managerId;
    for (let depth = 0; current && depth < 50; depth += 1) {
      if (current === userId) {
        throw new BadRequestException(
          'This manager assignment would create a reporting cycle.',
        );
      }
      if (seen.has(current)) {
        throw new BadRequestException('The reporting hierarchy already contains a cycle.');
      }
      seen.add(current);
      const next = await this.prisma.user.findUnique({
        where: { id: current },
        select: { managerId: true },
      });
      if (!next) {
        throw new BadRequestException('The selected manager does not exist.');
      }
      current = next.managerId;
    }
  }

  async assertSuperAdminRetained(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    if (!user || user.role !== 'SUPER_ADMIN' || !user.isActive) return;

    const remaining = await this.prisma.user.count({
      where: { role: 'SUPER_ADMIN', isActive: true, id: { not: userId } },
    });
    if (remaining === 0) {
      throw new ConflictException(
        'The last active Super Admin cannot be deactivated or demoted.',
      );
    }
  }

  async pendingApprovalsFor(managerId: string): Promise<number> {
    return this.prisma.leaveRequest.count({
      where: {
        status: { in: ['PENDING', 'PENDING_MANAGER', 'PENDING_HR'] },
        user: { managerId },
      },
    });
  }
}
