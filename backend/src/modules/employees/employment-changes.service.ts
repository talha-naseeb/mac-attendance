import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { SessionService } from '../auth/session.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { OrganizationGuardService } from './organization-guard.service';
import { EmploymentChangeDto } from './dto/employment-change.dto';
import { toCompanyDateIso } from '../../common/utils/company-time.util';

@Injectable()
export class EmploymentChangesService {
  constructor(
    private prisma: PrismaService,
    private organizationGuard: OrganizationGuardService,
    private sessionService: SessionService,
    private audit: AuditService,
  ) {}

  async apply(userId: string, dto: EmploymentChangeDto, actor: AuthenticatedUser) {
    const today = toCompanyDateIso();
    // The DTO accepts a full ISO timestamp; the ledger stores calendar dates.
    const effectiveDate = dto.effectiveDate.slice(0, 10);
    if (effectiveDate > today) {
      throw new BadRequestException(
        'Effective dates in the future are not supported yet. Choose today or a past date.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Employee ${userId} not found.`);
    }

    const before: Record<string, unknown> = {
      branchId: user.branchId,
      jobTitle: user.jobTitle,
      role: user.role,
      managerId: user.managerId,
      isRemoteAllowed: user.isRemoteAllowed,
      basicSalarySar: user.basicSalarySar,
      housingAllowanceSar: user.housingAllowanceSar,
      transportAllowanceSar: user.transportAllowanceSar,
    };
    let patch: Prisma.UserUpdateInput = {};
    let after: Record<string, unknown> = {};
    let extra: { salary: boolean } = { salary: false };

    switch (dto.type) {
      case 'TRANSFER': {
        if (!dto.branchId) throw new BadRequestException('branchId is required for a transfer.');
        patch = { branch: { connect: { id: dto.branchId } } };
        after = { branchId: dto.branchId };
        break;
      }
      case 'PROMOTION': {
        if (!dto.jobTitle) throw new BadRequestException('jobTitle is required for a promotion.');
        patch = { jobTitle: dto.jobTitle };
        after = { jobTitle: dto.jobTitle };
        break;
      }
      case 'SALARY': {
        if (dto.basicSalarySar === undefined) {
          throw new BadRequestException('basicSalarySar is required for a salary change.');
        }
        patch = {
          basicSalarySar: dto.basicSalarySar,
          housingAllowanceSar: dto.housingAllowanceSar ?? user.housingAllowanceSar,
          transportAllowanceSar: dto.transportAllowanceSar ?? user.transportAllowanceSar,
        };
        after = {
          basicSalarySar: dto.basicSalarySar,
          housingAllowanceSar: dto.housingAllowanceSar ?? user.housingAllowanceSar,
          transportAllowanceSar: dto.transportAllowanceSar ?? user.transportAllowanceSar,
        };
        extra = { salary: true };
        break;
      }
      case 'ROLE': {
        if (!dto.role) throw new BadRequestException('role is required for a role change.');
        if (dto.role === user.role) {
          throw new BadRequestException('The employee already holds this role.');
        }
        if (
          user.role === 'SUPER_ADMIN' &&
          dto.role !== 'SUPER_ADMIN' &&
          actor.role !== 'SUPER_ADMIN'
        ) {
          throw new ForbiddenException('Only a Super Admin can change a Super Admin role.');
        }
        if (dto.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
          throw new ForbiddenException('Only a Super Admin can grant the Super Admin role.');
        }
        patch = {
          role: dto.role,
          canAccessWebAdmin: dto.role === 'HR_ADMIN' || dto.role === 'SUPER_ADMIN',
        };
        after = { role: dto.role };
        break;
      }
      case 'MANAGER': {
        if (dto.managerId === undefined) {
          throw new BadRequestException(
            'managerId is required for a manager change. Send null to clear the manager.',
          );
        }
        if (dto.managerId === '') {
          throw new BadRequestException(
            'managerId cannot be empty. Send null to clear the manager.',
          );
        }
        patch = dto.managerId
          ? { manager: { connect: { id: dto.managerId } } }
          : { manager: { disconnect: true } };
        after = { managerId: dto.managerId };
        break;
      }
      case 'REMOTE_ELIGIBILITY': {
        if (typeof dto.isRemoteAllowed !== 'boolean') {
          throw new BadRequestException(
            'isRemoteAllowed is required for a remote eligibility change.',
          );
        }
        patch = {
          isRemoteAllowed: dto.isRemoteAllowed,
          remoteGrantedBy: dto.isRemoteAllowed
            ? { connect: { id: actor.id } }
            : { disconnect: true },
          remoteGrantedAt: dto.isRemoteAllowed ? new Date() : null,
        };
        after = {
          isRemoteAllowed: dto.isRemoteAllowed,
          remoteGrantedById: dto.isRemoteAllowed ? actor.id : null,
        };
        break;
      }
      default:
        throw new BadRequestException('Unsupported employment change type.');
    }

    const change = await this.prisma.$transaction(async (tx) => {
      // Resolve the branch inside the transaction so one deleted before commit
      // surfaces as the same 400 rather than a Prisma P2025 failure.
      if (dto.type === 'TRANSFER') {
        const branch = await tx.branch.findUnique({ where: { id: dto.branchId as string } });
        if (!branch) throw new BadRequestException('The destination branch does not exist.');
      }
      const created = await tx.employmentChange.create({
        data: {
          userId,
          type: dto.type,
          effectiveDate,
          reason: dto.reason,
          beforeJson: before as Prisma.InputJsonObject,
          afterJson: after as Prisma.InputJsonObject,
          actorUserId: actor.id,
        },
      });
      if (extra.salary) {
        await tx.employeeSalaryRecord.create({
          data: {
            userId,
            basicSalarySar: after.basicSalarySar as number,
            housingAllowanceSar: after.housingAllowanceSar as number,
            transportAllowanceSar: after.transportAllowanceSar as number,
            effectiveFrom: effectiveDate,
            changeId: created.id,
          },
        });
      }
      if (dto.type === 'MANAGER') {
        await this.organizationGuard.assertCanAssignManager(userId, dto.managerId ?? null, tx);
      }
      if (dto.type === 'ROLE' && user.role === 'SUPER_ADMIN' && dto.role !== 'SUPER_ADMIN') {
        await this.organizationGuard.assertSuperAdminRetained(userId, tx);
      }
      await tx.user.update({ where: { id: userId }, data: patch });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: 'EMPLOYMENT_CHANGE_APPLIED',
          resource: 'User',
          details: { userId, type: dto.type, effectiveDate, changeId: created.id },
        },
        tx,
      );
      return created;
    });

    if (dto.type === 'ROLE') {
      await this.sessionService.revokeAllForUser(userId, 'ROLE_CHANGE');
    }

    const employee = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { passwordHash, ...safeUser } = employee;
    return { change, employee: safeUser };
  }

  async list(userId: string) {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Employee ${userId} not found.`);
    return this.prisma.employmentChange.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        actor: { select: { firstName: true, lastName: true } },
        salaryRecord: true,
      },
    });
  }
}
