import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ClaimCategory, ClaimStage, ClaimStatus, UserRole } from '@prisma/client';
import { ClaimsService } from './claims.service';

describe('ClaimsService (Phase 12 — M11.1 to M11.4)', () => {
  let service: ClaimsService;
  let prisma: any;
  let audit: any;
  let notifications: any;
  let payrollService: any;

  const defaultPolicies = [
    {
      id: 'pol-med',
      category: ClaimCategory.MEDICAL,
      monthlyCapHalalas: 500_000,
      annualCapHalalas: 2_500_000,
      requiresReceipt: true,
      allowDirectToHr: true,
      isActive: true,
    },
    {
      id: 'pol-ins',
      category: ClaimCategory.INSURANCE,
      monthlyCapHalalas: 1_000_000,
      annualCapHalalas: 3_000_000,
      requiresReceipt: true,
      allowDirectToHr: true,
      isActive: true,
    },
    {
      id: 'pol-pet',
      category: ClaimCategory.PETROL,
      monthlyCapHalalas: 150_000,
      annualCapHalalas: 1_800_000,
      requiresReceipt: true,
      allowDirectToHr: false,
      isActive: true,
    },
    {
      id: 'pol-wifi',
      category: ClaimCategory.WIFI,
      monthlyCapHalalas: 50_000,
      annualCapHalalas: 600_000,
      requiresReceipt: true,
      allowDirectToHr: false,
      isActive: true,
    },
  ];

  beforeEach(() => {
    prisma = {
      reimbursementPolicy: {
        findMany: jest.fn().mockResolvedValue(defaultPolicies),
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(
            defaultPolicies.find((p) => p.category === where.category) ?? null,
          ),
        ),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      reimbursementClaim: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payrollRun: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'emp-1',
          employeeId: 'EMP-001',
          fullName: 'Saad Al-Otaibi',
          department: 'Engineering',
          jobTitle: 'Software Engineer',
          role: UserRole.EMPLOYEE,
          managerId: 'mgr-1',
        }),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    notifications = { createNotification: jest.fn().mockResolvedValue(undefined) };
    payrollService = { preparePayrollRun: jest.fn().mockResolvedValue(undefined) };

    service = new ClaimsService(prisma, audit, notifications, payrollService);
  });

  it('rejects claim submission without a supporting receipt attachment', async () => {
    await expect(
      service.submitClaim('emp-1', {
        category: ClaimCategory.WIFI,
        period: '2026-10',
        amountSar: 300,
        description: 'Monthly fiber internet',
        receiptUrl: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects claim submission exceeding the monthly policy cap unless requestCapException is set', async () => {
    await expect(
      service.submitClaim('emp-1', {
        category: ClaimCategory.WIFI,
        period: '2026-10',
        amountSar: 650, // Cap is 500 SAR
        description: 'Fiber setup + monthly bill',
        receiptUrl: 'https://storage.shiftly.app/receipts/wifi.pdf',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('routes standard Wi-Fi/Petrol claims to Stage 1 Manager', async () => {
    prisma.reimbursementClaim.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'claim-1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const claim = await service.submitClaim('emp-1', {
      category: ClaimCategory.WIFI,
      period: '2026-10',
      amountSar: 350,
      description: 'Home fiber internet',
      receiptUrl: 'https://storage.shiftly.app/receipts/wifi-oct.pdf',
    });

    expect(claim.status).toBe(ClaimStatus.PENDING_MANAGER);
    expect(claim.stage).toBe(ClaimStage.STAGE_1_MANAGER);
    expect(claim.routedDirectlyToHr).toBe(false);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'mgr-1' }),
    );
  });

  it('routes private Medical/Insurance claims directly to HR Admin and blocks Manager visibility', async () => {
    prisma.reimbursementClaim.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'claim-med-1',
        ...data,
        user: {
          id: 'emp-1',
          employeeId: 'EMP-001',
          fullName: 'Saad Al-Otaibi',
          managerId: 'mgr-1',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const claim = await service.submitClaim('emp-1', {
      category: ClaimCategory.MEDICAL,
      period: '2026-10',
      amountSar: 1200,
      description: 'Dental specialist treatment',
      receiptUrl: 'https://storage.shiftly.app/receipts/dental.pdf',
      isPrivateMedical: true,
    });

    expect(claim.status).toBe(ClaimStatus.PENDING_HR);
    expect(claim.stage).toBe(ClaimStage.STAGE_2_HR);
    expect(claim.isPrivateMedical).toBe(true);
    expect(claim.routedDirectlyToHr).toBe(true);

    prisma.reimbursementClaim.findUnique.mockResolvedValue({
      id: 'claim-med-1',
      userId: 'emp-1',
      category: ClaimCategory.MEDICAL,
      period: '2026-10',
      amountHalalas: 120_000,
      isPrivateMedical: true,
      routedDirectlyToHr: true,
      user: { id: 'emp-1', managerId: 'mgr-1' },
    });

    await expect(
      service.getClaimById('claim-med-1', 'mgr-1', UserRole.MANAGER),
    ).rejects.toThrow(ForbiddenException);

    const hrView = await service.getClaimById(
      'claim-med-1',
      'hr-1',
      UserRole.HR_ADMIN,
    );
    expect(hrView.id).toBe('claim-med-1');
  });

  it('completes Stage 1 -> Stage 2 approval and re-prepares unlocked payroll run', async () => {
    const baseClaim = {
      id: 'claim-pet-1',
      userId: 'emp-1',
      category: ClaimCategory.PETROL,
      period: '2026-10',
      amountHalalas: 40_000,
      currency: 'SAR',
      description: 'Client site visits fuel',
      receiptUrl: 'https://storage.shiftly.app/receipts/petrol.pdf',
      isPrivateMedical: false,
      routedDirectlyToHr: false,
      status: ClaimStatus.PENDING_MANAGER,
      stage: ClaimStage.STAGE_1_MANAGER,
      user: {
        id: 'emp-1',
        employeeId: 'EMP-001',
        fullName: 'Saad Al-Otaibi',
        managerId: 'mgr-1',
      },
      payrollRun: null,
    };

    prisma.reimbursementClaim.findUnique.mockResolvedValueOnce(baseClaim);
    prisma.reimbursementClaim.update.mockResolvedValueOnce({
      ...baseClaim,
      status: ClaimStatus.PENDING_HR,
      stage: ClaimStage.STAGE_2_HR,
      managerReviewedById: 'mgr-1',
    });

    const stage1 = await service.makeDecision(
      'claim-pet-1',
      'mgr-1',
      UserRole.MANAGER,
      { decision: 'APPROVED', comments: 'Approved trip fuel' },
    );
    expect(stage1.status).toBe(ClaimStatus.PENDING_HR);
    expect(stage1.stage).toBe(ClaimStage.STAGE_2_HR);

    // Stage 2 HR approval with an existing PREPARED payroll run
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 'run-2026-10',
      period: '2026-10',
      status: 'PREPARED',
      notes: 'Oct run',
    });
    prisma.reimbursementClaim.findUnique.mockResolvedValueOnce({
      ...baseClaim,
      status: ClaimStatus.PENDING_HR,
      stage: ClaimStage.STAGE_2_HR,
    });
    prisma.reimbursementClaim.update.mockResolvedValueOnce({
      ...baseClaim,
      status: ClaimStatus.APPROVED,
      stage: ClaimStage.COMPLETED,
      payrollRunId: 'run-2026-10',
    });
    prisma.reimbursementClaim.findUniqueOrThrow.mockResolvedValueOnce({
      ...baseClaim,
      status: ClaimStatus.APPROVED,
      stage: ClaimStage.COMPLETED,
      payrollRunId: 'run-2026-10',
    });

    const stage2 = await service.makeDecision(
      'claim-pet-1',
      'hr-1',
      UserRole.HR_ADMIN,
      { decision: 'APPROVED', comments: 'Included in Oct payroll' },
    );
    expect(stage2.status).toBe(ClaimStatus.APPROVED);
    expect(payrollService.preparePayrollRun).toHaveBeenCalledWith(
      '2026-10',
      'hr-1',
      'Oct run',
    );
  });

  it('blocks modifying or cancelling a claim linked to a LOCKED payroll run', async () => {
    prisma.reimbursementClaim.findUnique.mockResolvedValue({
      id: 'claim-locked',
      userId: 'emp-1',
      period: '2026-09',
      amountHalalas: 35_000,
      status: ClaimStatus.APPROVED,
      stage: ClaimStage.COMPLETED,
      payrollRun: { id: 'run-sep', status: 'LOCKED' },
    });

    await expect(
      service.cancelClaim('claim-locked', 'emp-1', UserRole.EMPLOYEE),
    ).rejects.toThrow(ConflictException);
  });
});
