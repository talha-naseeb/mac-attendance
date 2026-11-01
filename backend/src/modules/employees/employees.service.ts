import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { SessionService } from '../auth/session.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { OrganizationGuardService } from './organization-guard.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employees.dto';
import {
  AdminEmployeeQueryDto,
  EmployeeStatusFilter,
} from './dto/employee-admin.dto';
import { generateTemporaryPassword } from './credentials.util';

export interface EmployeeRequester {
  id: string;
  role: string;
}

const FULL_PROFILE_ROLES = new Set(['HR_ADMIN', 'SUPER_ADMIN']);

/**
 * Colleagues may see the work profile needed for the directory and org chart,
 * but never compensation, identity numbers, leave balances or credentials.
 */
const LIMITED_PROFILE_SELECT = {
  id: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  fullName: true,
  fullNameAr: true,
  jobTitle: true,
  titleAr: true,
  department: true,
  departmentAr: true,
  email: true,
  phone: true,
  avatarUrl: true,
  avatarInitials: true,
  avatarPresetId: true,
  avatarColor: true,
  branch: {
    select: { id: true, name: true, nameAr: true, code: true },
  },
  manager: {
    select: { id: true, firstName: true, lastName: true, jobTitle: true },
  },
  directReports: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      avatarUrl: true,
    },
  },
};

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private organizationGuard: OrganizationGuardService,
    private sessionService: SessionService,
    private audit: AuditService,
  ) {}

  async findAll(query?: { search?: string; department?: string; branchId?: string }) {
    const where: any = { isActive: true };

    if (query?.department) {
      where.department = query.department;
    }

    if (query?.branchId) {
      where.branchId = query.branchId;
    }

    if (query?.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { employeeId: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        department: true,
        jobTitle: true,
        role: true,
        isSaudi: true,
        avatarUrl: true,
        branch: {
          select: { id: true, name: true, nameAr: true, code: true },
        },
        manager: {
          select: { id: true, firstName: true, lastName: true, employeeId: true },
        },
      },
      orderBy: { employeeId: 'asc' },
    });
  }

  async findById(id: string, requester: EmployeeRequester) {
    const canViewFullProfile =
      requester.id === id || FULL_PROFILE_ROLES.has(requester.role);

    if (!canViewFullProfile) {
      const limitedUser = await this.prisma.user.findUnique({
        where: { id },
        select: LIMITED_PROFILE_SELECT,
      });

      if (!limitedUser) {
        throw new NotFoundException(`Employee ${id} not found.`);
      }

      return limitedUser;
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        branch: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            email: true,
          },
        },
        directReports: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            avatarUrl: true,
          },
        },
        leaveBalances: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Employee ${id} not found.`);
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private async ensureEmployeeExists(id: string) {
    const employee = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found.`);
    }
  }

  async findAllForAdmin(query: AdminEmployeeQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: any = {};

    if (query.status === EmployeeStatusFilter.ACTIVE) where.isActive = true;
    if (query.status === EmployeeStatusFilter.INACTIVE) where.isActive = false;

    if (query.department) where.department = query.department;
    if (query.branchId) where.branchId = query.branchId;
    const term = query.search?.trim();
    if (term) {
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { employeeId: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { jobTitle: { contains: term, mode: 'insensitive' } },
      ];
    }

    const direction = query.direction ?? 'asc';
    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      query.sort === 'name'
        ? [{ lastName: direction }, { firstName: direction }, { employeeId: 'asc' }]
        : query.sort === 'department'
          ? [{ department: direction }, { employeeId: 'asc' }]
          : query.sort === 'status'
            ? [{ isActive: direction }, { employeeId: 'asc' }]
            : [{ employeeId: direction }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          department: true,
          jobTitle: true,
          role: true,
          isSaudi: true,
          isActive: true,
          nationalId: true,
          iqamaNumber: true,
          basicSalarySar: true,
          housingAllowanceSar: true,
          transportAllowanceSar: true,
          avatarUrl: true,
          isRemoteAllowed: true,
          mustChangePassword: true,
          branch: { select: { id: true, name: true, nameAr: true, code: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async create(dto: CreateEmployeeDto, actor: AuthenticatedUser) {
    if (dto.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a Super Admin can create another Super Admin.');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email.toLowerCase() }, { employeeId: dto.employeeId }],
      },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === dto.email.toLowerCase()
          ? `An employee with email ${dto.email} already exists.`
          : `Employee ID ${dto.employeeId} is already in use.`,
      );
    }

    if (dto.managerId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.managerId },
        select: { isActive: true },
      });
      if (!manager) {
        throw new BadRequestException('The selected manager does not exist.');
      }
      if (!manager.isActive) {
        throw new BadRequestException('The selected manager is not active.');
      }
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const year = new Date().getFullYear();
    const balances = dto.initialLeaveBalances?.length
      ? dto.initialLeaveBalances
      : [
          { leaveType: 'ANNUAL', totalDays: 30 },
          { leaveType: 'SICK', totalDays: 30 },
          { leaveType: 'HAJJ', totalDays: 10 },
          { leaveType: 'PATERNITY', totalDays: 3 },
        ];

    const employee = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          employeeId: dto.employeeId,
          email: dto.email.toLowerCase(),
          passwordHash,
          mustChangePassword: true,
          role: dto.role,
          firstName: dto.firstName,
          lastName: dto.lastName,
          fullName: `${dto.firstName} ${dto.lastName}`,
          fullNameAr: dto.fullNameAr ?? `${dto.firstName} ${dto.lastName}`,
          jobTitle: dto.jobTitle,
          titleAr: dto.titleAr,
          department: dto.department,
          departmentAr: dto.departmentAr,
          phone: dto.phone ?? '',
          isSaudi: dto.isSaudi,
          nationalId: dto.nationalId,
          iqamaNumber: dto.iqamaNumber,
          basicSalarySar: dto.basicSalarySar,
          housingAllowanceSar: dto.housingAllowanceSar ?? 0,
          transportAllowanceSar: dto.transportAllowanceSar ?? 0,
          branchId: dto.branchId,
          managerId: dto.managerId,
          isRemoteAllowed: dto.isRemoteAllowed ?? false,
          remoteGrantedById: dto.isRemoteAllowed ? actor.id : null,
          remoteGrantedAt: dto.isRemoteAllowed ? new Date() : null,
          canAccessWebAdmin:
            dto.role === 'HR_ADMIN' || dto.role === 'SUPER_ADMIN',
        },
      });
      await tx.leaveBalance.createMany({
        data: balances.map((balance) => ({
          userId: created.id,
          leaveType: balance.leaveType,
          totalDays: balance.totalDays,
          usedDays: 0,
          year,
        })),
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: 'EMPLOYEE_CREATED',
          resource: 'User',
          details: { employeeId: created.employeeId, role: created.role },
        },
        tx,
      );
      return created;
    });

    const { passwordHash: _, ...safeUser } = employee;
    return { employee: safeUser, temporaryPassword };
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: AuthenticatedUser) {
    await this.ensureEmployeeExists(id);
    const data: any = { ...dto };
    if (dto.firstName || dto.lastName) {
      const current = await this.prisma.user.findUniqueOrThrow({
        where: { id },
        select: { firstName: true, lastName: true },
      });
      const firstName = dto.firstName ?? current.firstName;
      const lastName = dto.lastName ?? current.lastName;
      data.fullName = `${firstName} ${lastName}`;
    }
    const updated = await this.prisma.user.update({ where: { id }, data });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'EMPLOYEE_UPDATED',
      resource: 'User',
      details: { employeeId: updated.employeeId, fields: Object.keys(dto) },
    });
    const { passwordHash, ...safeUser } = updated;
    return safeUser;
  }

  /**
   * Deactivating a person is one transaction: a surviving Super Admin is
   * guaranteed, live leave requests are cancelled, the account is switched off
   * and the audit trail is written together with those changes. Sessions are
   * revoked only once the transaction has committed.
   */
  async deactivate(id: string, reason: string, actor: AuthenticatedUser) {
    await this.ensureEmployeeExists(id);
    const target = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { role: true },
    });
    if (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a Super Admin can deactivate a Super Admin.');
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      await this.organizationGuard.assertSuperAdminRetained(id, tx);

      const pending = await tx.leaveRequest.updateMany({
        where: { userId: id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          rejectionReason: 'Account deactivated by HR.',
          decidedById: actor.id,
          decidedAt: new Date(),
        },
      });
      await tx.user.update({ where: { id }, data: { isActive: false } });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: 'EMPLOYEE_DEACTIVATED',
          resource: 'User',
          details: { userId: id, reason, pendingLeaveRequestsCancelled: pending.count },
        },
        tx,
      );
      return pending.count;
    });

    await this.sessionService.revokeAllForUser(id, 'DEACTIVATED');

    return { deactivated: true, pendingLeaveRequestsCancelled: cancelled };
  }

  /**
   * Reactivation re-enables the account. Sessions are not recreated; the
   * employee signs in again.
   */
  async reactivate(id: string, reason: string, actor: AuthenticatedUser) {
    await this.ensureEmployeeExists(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { isActive: true } });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: 'EMPLOYEE_REACTIVATED',
          resource: 'User',
          details: { userId: id, reason },
        },
        tx,
      );
    });

    return { reactivated: true };
  }
}
