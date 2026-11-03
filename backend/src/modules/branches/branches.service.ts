import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branches.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found.`);
    }

    return branch;
  }

  async findAllForAdmin() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            users: { where: { isActive: true } },
            attendance: { where: { timestamp: { gte: startOfToday, lte: endOfToday } } },
          },
        },
      },
    });
  }

  async create(createDto: CreateBranchDto, actorUserId?: string) {
    const created = await this.prisma.branch.create({
      data: {
        ...createDto,
        nameAr: createDto.nameAr || createDto.name,
        cityAr: createDto.cityAr || createDto.city,
        geofenceRadiusMeters: createDto.geofenceRadiusMeters ?? 150,
        radiusMeters: createDto.geofenceRadiusMeters ?? 150,
      },
    });
    if (this.prisma.auditLog?.create) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: 'BRANCH_CREATED',
          resource: 'Branch',
          detailsJson: {
            branchId: created.id,
            name: created.name,
            city: created.city,
            geofenceRadiusMeters: created.geofenceRadiusMeters,
          },
        },
      });
    }
    return created;
  }

  async update(id: string, updateDto: UpdateBranchDto, actorUserId?: string) {
    await this.findById(id);
    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...updateDto,
        ...(updateDto.geofenceRadiusMeters !== undefined
          ? { radiusMeters: updateDto.geofenceRadiusMeters }
          : {}),
      },
    });
    if (this.prisma.auditLog?.create) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: 'BRANCH_UPDATED',
          resource: 'Branch',
          detailsJson: {
            branchId: updated.id,
            name: updated.name,
            geofenceRadiusMeters: updated.geofenceRadiusMeters,
          },
        },
      });
    }
    return updated;
  }

  async remove(id: string, actorUserId?: string) {
    const branch = await this.findById(id);

    if (this.prisma.user?.updateMany) {
      await this.prisma.user.updateMany({
        where: { branchId: id },
        data: { branchId: null },
      });
    }
    if (this.prisma.attendanceRecord?.updateMany) {
      await this.prisma.attendanceRecord.updateMany({
        where: { branchId: id },
        data: { branchId: null },
      });
    }

    await this.prisma.branch.delete({
      where: { id },
    });

    if (this.prisma.auditLog?.create) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: 'BRANCH_DELETED',
          resource: 'Branch',
          detailsJson: {
            branchId: branch.id,
            name: branch.name,
            code: branch.code,
            city: branch.city,
            unassignedEmployeesCount: branch.users?.length ?? 0,
          },
        },
      });
    }

    return {
      deleted: true,
      id: branch.id,
      name: branch.name,
      unassignedEmployeesCount: branch.users?.length ?? 0,
    };
  }
}
