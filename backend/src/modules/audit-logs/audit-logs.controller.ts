import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@ApiBearerAuth()
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'List system & security audit logs (50 per page, capped at 20 pages, fetched on request per page)',
  })
  async listAuditLogs(@Query() query: AuditLogsQueryDto) {
    return this.auditLogsService.findPaginated(query);
  }
}
