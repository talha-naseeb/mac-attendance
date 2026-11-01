import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type GuardClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class OrganizationGuardService {
  constructor(private prisma: PrismaService) {}

  async assertCanAssignManager(
    userId: string,
    managerId: string | null | undefined,
    client: GuardClient = this.prisma,
  ): Promise<void> {
    if (managerId === null || managerId === undefined) return;
    if (managerId === userId) {
      throw new BadRequestException('An employee cannot be their own manager.');
    }

    const seen = new Set<string>();
    let current: string | null = managerId;
    while (current !== null) {
      if (current === userId) {
        throw new BadRequestException(
          'This manager assignment would create a reporting cycle.',
        );
      }
      if (seen.has(current)) {
        throw new BadRequestException('The reporting hierarchy already contains a cycle.');
      }
      seen.add(current);
      const next = await client.user.findUnique({
        where: { id: current },
        select: { managerId: true },
      });
      if (!next) {
        throw new BadRequestException('The selected manager does not exist.');
      }
      current = next.managerId;
    }
  }

  async assertSuperAdminRetained(
    userId: string,
    client: GuardClient = this.prisma,
  ): Promise<void> {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    if (!user || user.role !== 'SUPER_ADMIN' || !user.isActive) return;

    const remaining = await client.user.count({
      where: { role: 'SUPER_ADMIN', isActive: true, id: { not: userId } },
    });
    if (remaining === 0) {
      throw new ConflictException(
        'The last active Super Admin cannot be deactivated or demoted.',
      );
    }
  }

  async pendingApprovalsFor(managerId: string): Promise<number> {
    const target = await this.prisma.user.findUnique({
      where: { id: managerId },
      select: { role: true },
    });
    if (!target) return 0;
    if (target.role === 'HR_ADMIN' || target.role === 'SUPER_ADMIN') {
      return this.prisma.leaveRequest.count({ where: { status: 'PENDING' } });
    }
    return this.prisma.leaveRequest.count({
      where: { status: 'PENDING', user: { managerId, isActive: true } },
    });
  }
}
