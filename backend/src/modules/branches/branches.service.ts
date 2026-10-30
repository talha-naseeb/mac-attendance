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

  async create(createDto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        ...createDto,
        nameAr: createDto.nameAr || createDto.name,
        cityAr: createDto.cityAr || createDto.city,
        geofenceRadiusMeters: createDto.geofenceRadiusMeters ?? 150,
        radiusMeters: createDto.geofenceRadiusMeters ?? 150,
      },
    });
  }

  async update(id: string, updateDto: UpdateBranchDto) {
    await this.findById(id);
    return this.prisma.branch.update({
      where: { id },
      data: {
        ...updateDto,
        ...(updateDto.geofenceRadiusMeters !== undefined
          ? { radiusMeters: updateDto.geofenceRadiusMeters }
          : {}),
      },
    });
  }
}
