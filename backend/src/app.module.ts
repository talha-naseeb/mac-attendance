import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PasswordChangeGuard } from './common/guards/password-change.guard';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    BranchesModule,
    AttendanceModule,
    LeavesModule,
    EmployeesModule,
    PayrollModule,
    DirectoryModule,
    AuditLogsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PasswordChangeGuard,
    },
  ],
})
export class AppModule {}
