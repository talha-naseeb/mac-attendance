import { Controller, Get, Req, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './database/prisma.service';

@ApiTags('Health & Discovery')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'API Root Health & System Discovery' })
  @ApiResponse({ status: 200, description: 'Shiftly / MacqHR Backend is operational.' })
  async getRoot(@Req() req: Request) {
    return this.buildHealthPayload(req);
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Deep dependency health check (Database & Runtime)' })
  @ApiResponse({ status: 200, description: 'All dependencies healthy.' })
  async getHealth(@Req() req: Request) {
    return this.buildHealthPayload(req);
  }

  private async buildHealthPayload(req: Request) {
    let dbStatus: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'down';
    }

    const payload = {
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      service: 'Shiftly / MacqHR Enterprise API',
      version: '1.0.0',
      requestId: (req as any).requestId || req.headers['x-request-id'] || null,
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: {
        database: dbStatus,
      },
      timestamp: new Date().toISOString(),
      docs: '/api/docs',
    };

    if (dbStatus !== 'up') {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
