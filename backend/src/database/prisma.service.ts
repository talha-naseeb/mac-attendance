import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Optional() configService?: ConfigService) {
    const dbUrl = configService?.get<string>('databaseUrl') || process.env.DATABASE_URL;
    super(dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined);
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma client connected to PostgreSQL database successfully.');
    } catch (error) {
      this.logger.warn(
        `Prisma database connection deferred (will connect on first query or when DB is available): ${error.message}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma client disconnected.');
  }
}
