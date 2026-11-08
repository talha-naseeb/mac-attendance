import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import {
  ExpiringDocumentsQueryDto,
  UploadDocumentDto,
  VerifyDocumentDto,
} from './dto/documents.dto';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Personal Document Vault')
@Controller('documents')
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Upload a document to the Personal Document Vault (Iqama/National ID, Passport, Medical Insurance, Contract)',
  })
  @ApiResponse({ status: 201, description: 'Document uploaded to vault' })
  async uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.uploadDocument(user.id, user.role, dto);
  }

  @Get('my')
  @ApiOperation({
    summary: 'List authenticated employee documents in the Document Vault',
  })
  async getMyDocuments(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.getMyDocuments(user.id);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List all employee documents in the vault (HR/Super Admin only)',
  })
  async getAllDocumentsForAdmin() {
    return this.documentsService.getAllDocumentsForAdmin();
  }

  @Get('expiring')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'List expired or upcoming expiring employee documents within lookahead days (HR/Super Admin only)',
  })
  @ApiQuery({ name: 'withinDays', required: false, example: 60 })
  async getExpiringDocuments(@Query() query: ExpiringDocumentsQueryDto) {
    return this.documentsService.getExpiringDocuments(query.withinDays ?? 60);
  }

  @Post('reminders/expiring')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Trigger automated push and in-app reminders for expiring documents',
  })
  async sendExpiryReminders(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ExpiringDocumentsQueryDto,
  ) {
    return this.documentsService.sendExpiryReminders(
      dto.withinDays ?? 60,
      user.id,
    );
  }

  @Get('user/:userId')
  @ApiOperation({
    summary:
      'List documents for a specific employee (restricted to owner, HR Admin, and Super Admin)',
  })
  async getUserDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') targetUserId: string,
  ) {
    return this.documentsService.getUserDocuments(
      targetUserId,
      user.id,
      user.role,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get a single document from the vault (restricted to owner, HR Admin, and Super Admin)',
  })
  async getDocumentById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.documentsService.getDocumentById(id, user.id, user.role);
  }

  @Patch(':id/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Verify or reject an uploaded employee document (HR/Super Admin)',
  })
  async verifyDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.documentsService.verifyDocument(id, user.id, dto);
  }
}
