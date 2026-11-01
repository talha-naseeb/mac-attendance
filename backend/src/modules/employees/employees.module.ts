import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { OrganizationGuardService } from './organization-guard.service';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, OrganizationGuardService],
  exports: [EmployeesService, OrganizationGuardService],
})
export class EmployeesModule {}
