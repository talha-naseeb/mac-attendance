import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { OrganizationGuardService } from './organization-guard.service';
import { EmploymentChangesService } from './employment-changes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, OrganizationGuardService, EmploymentChangesService],
  exports: [EmployeesService, OrganizationGuardService],
})
export class EmployeesModule {}
