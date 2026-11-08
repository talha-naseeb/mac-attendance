import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentVerificationStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  UploadDocumentDto,
  VerifyDocumentDto,
} from './dto/documents.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit?: AuditService,
    private readonly notifications?: NotificationsService,
  ) {}

  private computeExpiryMeta(expiryDateIso?: string | null) {
    if (!expiryDateIso) {
      return {
        daysUntilExpiry: null as number | null,
        isExpired: false,
        isExpiringSoon: false,
      };
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const todayMs = new Date(`${todayIso}T00:00:00.000Z`).getTime();
    const expiryMs = new Date(`${expiryDateIso}T00:00:00.000Z`).getTime();
    const daysUntilExpiry = Math.round((expiryMs - todayMs) / (1000 * 60 * 60 * 24));

    return {
      daysUntilExpiry,
      isExpired: daysUntilExpiry < 0,
      isExpiringSoon: daysUntilExpiry >= 0 && daysUntilExpiry <= 60,
    };
  }

  private formatDocument(doc: any) {
    const expiryMeta = this.computeExpiryMeta(doc.expiryDateIso);
    return {
      id: doc.id,
      userId: doc.userId,
      employee: doc.user
        ? {
            id: doc.user.id,
            employeeId: doc.user.employeeId,
            fullName: doc.user.fullName,
            department: doc.user.department,
            jobTitle: doc.user.jobTitle,
          }
        : undefined,
      documentType: doc.documentType,
      title: doc.title,
      documentNumber: doc.documentNumber,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      issuedDateIso: doc.issuedDateIso,
      expiryDateIso: doc.expiryDateIso,
      status: expiryMeta.isExpired
        ? DocumentVerificationStatus.EXPIRED
        : doc.status,
      daysUntilExpiry: expiryMeta.daysUntilExpiry,
      isExpired: expiryMeta.isExpired,
      isExpiringSoon: expiryMeta.isExpiringSoon,
      verifiedById: doc.verifiedById,
      verifiedAt: doc.verifiedAt,
      verificationNote: doc.verificationNote,
      uploadedById: doc.uploadedById,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * M11.5: Uploads a personal/compliance document to the employee's Document Vault.
   */
  async uploadDocument(
    actorUserId: string,
    actorRole: string,
    dto: UploadDocumentDto,
  ) {
    if (!dto.fileUrl || !dto.fileUrl.trim()) {
      throw new BadRequestException('Document fileUrl is required.');
    }
    if (!dto.title || !dto.title.trim()) {
      throw new BadRequestException('Document title is required.');
    }

    const isHrOrSuper =
      actorRole === UserRole.HR_ADMIN || actorRole === UserRole.SUPER_ADMIN;
    const targetUserId = dto.userId?.trim() || actorUserId;

    if (targetUserId !== actorUserId && !isHrOrSuper) {
      throw new ForbiddenException(
        'Only HR Admin or Super Admin can upload documents on behalf of another employee.',
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('Employee not found.');
    }

    if (
      dto.issuedDateIso &&
      dto.expiryDateIso &&
      dto.expiryDateIso < dto.issuedDateIso
    ) {
      throw new BadRequestException(
        'Document expiry date cannot precede the issued date.',
      );
    }

    // If uploaded directly by HR/Super Admin, auto-verify unless specified otherwise
    const initialStatus = isHrOrSuper && targetUserId !== actorUserId
      ? DocumentVerificationStatus.VERIFIED
      : DocumentVerificationStatus.PENDING_VERIFICATION;

    const created = await this.prisma.employeeDocument.create({
      data: {
        userId: targetUserId,
        documentType: dto.documentType,
        title: dto.title.trim(),
        documentNumber: dto.documentNumber?.trim() || null,
        fileUrl: dto.fileUrl.trim(),
        fileName: dto.fileName?.trim() || null,
        issuedDateIso: dto.issuedDateIso || null,
        expiryDateIso: dto.expiryDateIso || null,
        status: initialStatus,
        verifiedById:
          initialStatus === DocumentVerificationStatus.VERIFIED
            ? actorUserId
            : null,
        verifiedAt:
          initialStatus === DocumentVerificationStatus.VERIFIED
            ? new Date()
            : null,
        uploadedById: actorUserId,
      },
      include: { user: true },
    });

    await this.audit?.record({
      actorUserId,
      action: 'EMPLOYEE_DOCUMENT_UPLOADED',
      resource: 'EmployeeDocument',
      details: {
        documentId: created.id,
        userId: targetUserId,
        documentType: created.documentType,
        expiryDateIso: created.expiryDateIso,
      },
    });

    return this.formatDocument(created);
  }

  async getMyDocuments(userId: string) {
    const docs = await this.prisma.employeeDocument.findMany({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => this.formatDocument(d));
  }

  /**
   * M11.5 Rule: Document vault files are access-controlled:
   * only the employee, HR_ADMIN, and SUPER_ADMIN can view personal identity or insurance documents.
   */
  async getDocumentById(
    documentId: string,
    actorUserId: string,
    actorRole: string,
  ) {
    const doc = await this.prisma.employeeDocument.findUnique({
      where: { id: documentId },
      include: { user: true },
    });
    if (!doc) {
      throw new NotFoundException('Document not found.');
    }

    const isOwner = doc.userId === actorUserId;
    const isHrOrSuper =
      actorRole === UserRole.HR_ADMIN || actorRole === UserRole.SUPER_ADMIN;

    if (!isOwner && !isHrOrSuper) {
      throw new ForbiddenException(
        'Document Vault access is restricted to the document owner, HR Admin, and Super Admin.',
      );
    }

    return this.formatDocument(doc);
  }

  async getUserDocuments(
    targetUserId: string,
    actorUserId: string,
    actorRole: string,
  ) {
    const isOwner = targetUserId === actorUserId;
    const isHrOrSuper =
      actorRole === UserRole.HR_ADMIN || actorRole === UserRole.SUPER_ADMIN;

    if (!isOwner && !isHrOrSuper) {
      throw new ForbiddenException(
        'Document Vault access is restricted to the document owner, HR Admin, and Super Admin.',
      );
    }

    const docs = await this.prisma.employeeDocument.findMany({
      where: { userId: targetUserId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => this.formatDocument(d));
  }

  async getAllDocumentsForAdmin() {
    const docs = await this.prisma.employeeDocument.findMany({
      include: { user: true },
      orderBy: [{ expiryDateIso: 'asc' }, { createdAt: 'desc' }],
    });
    return docs.map((d) => this.formatDocument(d));
  }

  async getExpiringDocuments(withinDays = 60) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() + withinDays);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const docs = await this.prisma.employeeDocument.findMany({
      where: {
        expiryDateIso: { not: null, lte: cutoffIso },
      },
      include: { user: true },
      orderBy: { expiryDateIso: 'asc' },
    });

    return docs.map((d) => this.formatDocument(d));
  }

  async verifyDocument(
    documentId: string,
    actorUserId: string,
    dto: VerifyDocumentDto,
  ) {
    const existing = await this.prisma.employeeDocument.findUnique({
      where: { id: documentId },
      include: { user: true },
    });
    if (!existing) {
      throw new NotFoundException('Document not found.');
    }

    const updated = await this.prisma.employeeDocument.update({
      where: { id: documentId },
      data: {
        status: dto.status,
        verifiedById: actorUserId,
        verifiedAt: new Date(),
        verificationNote: dto.verificationNote?.trim() || null,
      },
      include: { user: true },
    });

    await this.audit?.record({
      actorUserId,
      action:
        dto.status === DocumentVerificationStatus.VERIFIED
          ? 'EMPLOYEE_DOCUMENT_VERIFIED'
          : 'EMPLOYEE_DOCUMENT_REJECTED',
      resource: 'EmployeeDocument',
      details: {
        documentId: updated.id,
        userId: updated.userId,
        documentType: updated.documentType,
        status: updated.status,
        verificationNote: updated.verificationNote,
      },
    });

    await this.notifications
      ?.createNotification({
        userId: updated.userId,
        actorId: actorUserId,
        type: NotificationType.SYSTEM,
        title:
          dto.status === DocumentVerificationStatus.VERIFIED
            ? `Document Verified: ${updated.title}`
            : `Document Action Required: ${updated.title}`,
        titleAr:
          dto.status === DocumentVerificationStatus.VERIFIED
            ? `تم التحقق من المستند: ${updated.title}`
            : `مطلوب تحديث المستند: ${updated.title}`,
        body:
          dto.status === DocumentVerificationStatus.VERIFIED
            ? `HR verified your ${updated.title} (${updated.documentType}) in your Personal Document Vault.`
            : `HR could not verify your ${updated.title}.${dto.verificationNote ? ` Reason: ${dto.verificationNote}` : ''}`,
        dataJson: {
          documentId: updated.id,
          documentType: updated.documentType,
          status: updated.status,
        },
      })
      .catch(() => undefined);

    return this.formatDocument(updated);
  }

  async sendExpiryReminders(withinDays = 60, actorUserId?: string) {
    const expiring = await this.getExpiringDocuments(withinDays);
    const notified: Array<{
      documentId: string;
      userId: string;
      documentType: string;
      expiryDateIso: string | null;
      daysUntilExpiry: number | null;
    }> = [];

    for (const doc of expiring) {
      const statusLabel = doc.isExpired
        ? 'has expired'
        : `expires in ${doc.daysUntilExpiry} day(s) on ${doc.expiryDateIso}`;

      await this.notifications
        ?.createNotification({
          userId: doc.userId,
          actorId: actorUserId,
          type: NotificationType.SYSTEM,
          title: `Document Expiry Reminder: ${doc.title}`,
          titleAr: `تذكير بانتهاء صلاحية المستند: ${doc.title}`,
          body: `Your ${doc.title} (${doc.documentType}) ${statusLabel}. Please upload a renewed copy in your Document Vault.`,
          dataJson: {
            documentId: doc.id,
            documentType: doc.documentType,
            expiryDateIso: doc.expiryDateIso,
          },
        })
        .catch(() => undefined);

      notified.push({
        documentId: doc.id,
        userId: doc.userId,
        documentType: doc.documentType,
        expiryDateIso: doc.expiryDateIso,
        daysUntilExpiry: doc.daysUntilExpiry,
      });
    }

    await this.audit?.record({
      actorUserId: actorUserId ?? null,
      action: 'DOCUMENT_EXPIRY_REMINDERS_SENT',
      resource: 'EmployeeDocument',
      details: { withinDays, count: notified.length },
    });

    return {
      withinDays,
      remindersSent: notified.length,
      recipients: notified,
    };
  }
}
