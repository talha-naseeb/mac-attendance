import { ForbiddenException } from '@nestjs/common';
import {
  DocumentType,
  DocumentVerificationStatus,
  UserRole,
} from '@prisma/client';
import { DocumentsService } from './documents.service';

describe('DocumentsService (Phase 12 — M11.5 Personal Document Vault)', () => {
  let service: DocumentsService;
  let prisma: any;
  let audit: any;
  let notifications: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'emp-1',
          employeeId: 'EMP-001',
          fullName: 'Saad Al-Otaibi',
        }),
      },
      employeeDocument: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    notifications = { createNotification: jest.fn().mockResolvedValue(undefined) };

    service = new DocumentsService(prisma, audit, notifications);
  });

  it('uploads an employee document with PENDING_VERIFICATION status and expiry metadata', async () => {
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 30);
    const expiryIso = futureDate.toISOString().slice(0, 10);

    prisma.employeeDocument.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'doc-1',
        ...data,
        user: {
          id: 'emp-1',
          employeeId: 'EMP-001',
          fullName: 'Saad Al-Otaibi',
          department: 'Engineering',
          jobTitle: 'Engineer',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const doc = await service.uploadDocument('emp-1', UserRole.EMPLOYEE, {
      documentType: DocumentType.NATIONAL_ID_IQAMA,
      title: 'Saudi National ID',
      documentNumber: '1033333333',
      fileUrl: 'https://storage.shiftly.app/vault/id-1033333333.pdf',
      expiryDateIso: expiryIso,
    });

    expect(doc.status).toBe(DocumentVerificationStatus.PENDING_VERIFICATION);
    expect(doc.isExpiringSoon).toBe(true);
    expect(doc.isExpired).toBe(false);
  });

  it('enforces strict vault access control (blocks Manager and other Employees)', async () => {
    prisma.employeeDocument.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'emp-1',
      documentType: DocumentType.MEDICAL_INSURANCE,
      title: 'Bupa Gold Medical Card',
      fileUrl: 'https://storage.shiftly.app/vault/bupa.pdf',
      status: DocumentVerificationStatus.VERIFIED,
    });

    await expect(
      service.getDocumentById('doc-1', 'mgr-1', UserRole.MANAGER),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.getDocumentById('doc-1', 'emp-2', UserRole.EMPLOYEE),
    ).rejects.toThrow(ForbiddenException);

    const ownerView = await service.getDocumentById(
      'doc-1',
      'emp-1',
      UserRole.EMPLOYEE,
    );
    expect(ownerView.id).toBe('doc-1');

    const hrView = await service.getDocumentById(
      'doc-1',
      'hr-1',
      UserRole.HR_ADMIN,
    );
    expect(hrView.id).toBe('doc-1');
  });

  it('allows HR Admin to verify a document and notifies the employee', async () => {
    prisma.employeeDocument.findUnique.mockResolvedValue({
      id: 'doc-1',
      userId: 'emp-1',
      documentType: DocumentType.PASSPORT,
      title: 'Saudi Passport',
      fileUrl: 'https://storage.shiftly.app/vault/passport.pdf',
      status: DocumentVerificationStatus.PENDING_VERIFICATION,
    });

    prisma.employeeDocument.update.mockResolvedValue({
      id: 'doc-1',
      userId: 'emp-1',
      documentType: DocumentType.PASSPORT,
      title: 'Saudi Passport',
      fileUrl: 'https://storage.shiftly.app/vault/passport.pdf',
      status: DocumentVerificationStatus.VERIFIED,
      verifiedById: 'hr-1',
      verificationNote: 'Verified against Absher',
    });

    const verified = await service.verifyDocument('doc-1', 'hr-1', {
      status: DocumentVerificationStatus.VERIFIED,
      verificationNote: 'Verified against Absher',
    });

    expect(verified.status).toBe(DocumentVerificationStatus.VERIFIED);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'emp-1' }),
    );
  });
});
