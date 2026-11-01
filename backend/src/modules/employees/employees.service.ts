import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employees.dto';
import {
  AdminEmployeeQueryDto,
  EmployeeStatusFilter,
} from './dto/employee-admin.dto';

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
  constructor(private prisma: PrismaService) {}

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

  async create(dto: CreateEmployeeDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email.toLowerCase() }, { employeeId: dto.employeeId }],
      },
    });

    if (existing) {
      throw new ConflictException(
        `Employee with email ${dto.email} or ID ${dto.employeeId} already exists.`,
      );
    }

    const defaultPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        employeeId: dto.employeeId,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role as any,
        firstName: dto.firstName,
        lastName: dto.lastName,
        fullName: `${dto.firstName} ${dto.lastName}`,
        fullNameAr: `${dto.firstName} ${dto.lastName}`,
        jobTitle: dto.jobTitle,
        department: dto.department,
        phone: dto.phone || '',
        isSaudi: dto.isSaudi,
        nationalId: dto.nationalId,
        iqamaNumber: dto.iqamaNumber,
        basicSalarySar: dto.basicSalarySar,
        housingAllowanceSar: dto.housingAllowanceSar ?? 0,
        transportAllowanceSar: dto.transportAllowanceSar ?? 0,
        branchId: dto.branchId,
        managerId: dto.managerId,
        canAccessWebAdmin: dto.role === 'HR_ADMIN' || dto.role === 'SUPER_ADMIN',
      },
    });

    // Seed default leave balances for current year
    const year = new Date().getFullYear();
    await this.prisma.leaveBalance.createMany({
      data: [
        { userId: user.id, leaveType: 'ANNUAL', totalDays: 30, usedDays: 0, year },
        { userId: user.id, leaveType: 'SICK', totalDays: 30, usedDays: 0, year },
        { userId: user.id, leaveType: 'HAJJ', totalDays: 10, usedDays: 0, year },
        { userId: user.id, leaveType: 'PATERNITY', totalDays: 3, usedDays: 0, year },
      ],
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.ensureEmployeeExists(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    const { passwordHash, ...safeUser } = updated;
    return safeUser;
  }
}
