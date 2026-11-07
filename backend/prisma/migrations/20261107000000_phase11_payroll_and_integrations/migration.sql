-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('PREPARED', 'REVIEWED', 'LOCKED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('TEAMS', 'OUTLOOK', 'ENTRA_SSO');

-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "LeaveRequest" ALTER COLUMN "daysCount" SET DEFAULT 1.0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "iban" TEXT DEFAULT 'SA0380000000608010167519';

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'PREPARED',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "totalBasicHalalas" INTEGER NOT NULL DEFAULT 0,
    "totalHousingHalalas" INTEGER NOT NULL DEFAULT 0,
    "totalTransportHalalas" INTEGER NOT NULL DEFAULT 0,
    "totalOvertimeHalalas" INTEGER NOT NULL DEFAULT 0,
    "totalAdjustmentsHalalas" INTEGER NOT NULL DEFAULT 0,
    "totalGrossHalalas" INTEGER NOT NULL DEFAULT 0,
    "totalUnpaidLeaveHalalas" INTEGER NOT NULL DEFAULT 0,
    "totalGosiEmployeeHalalas" INTEGER NOT NULL DEFAULT 0,
    "totalGosiEmployerHalalas" INTEGER NOT NULL DEFAULT 0,
    "totalNetHalalas" INTEGER NOT NULL DEFAULT 0,
    "gosiPolicyJson" JSONB,
    "notes" TEXT,
    "preparedById" TEXT,
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "employeeIdSnapshot" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT NOT NULL,
    "departmentSnapshot" TEXT NOT NULL,
    "jobTitleSnapshot" TEXT NOT NULL,
    "isSaudiSnapshot" BOOLEAN NOT NULL,
    "nationalOrIqamaIdSnapshot" TEXT,
    "ibanSnapshot" TEXT,
    "basicSalaryHalalas" INTEGER NOT NULL,
    "housingAllowanceHalalas" INTEGER NOT NULL,
    "transportAllowanceHalalas" INTEGER NOT NULL,
    "overtimeHalalas" INTEGER NOT NULL DEFAULT 0,
    "adjustmentsHalalas" INTEGER NOT NULL DEFAULT 0,
    "grossSalaryHalalas" INTEGER NOT NULL,
    "unpaidLeaveDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unpaidLeaveDeductionHalalas" INTEGER NOT NULL DEFAULT 0,
    "gosiContributoryHalalas" INTEGER NOT NULL,
    "gosiEmployeeHalalas" INTEGER NOT NULL,
    "gosiEmployerHalalas" INTEGER NOT NULL,
    "totalDeductionsHalalas" INTEGER NOT NULL,
    "netSalaryHalalas" INTEGER NOT NULL,
    "breakdownJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amountHalalas" INTEGER NOT NULL,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollWpsExport" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "totalNetHalalas" INTEGER NOT NULL,
    "csvSha256" TEXT NOT NULL,
    "exportedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollWpsExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "webhookUrl" TEXT,
    "tenantId" TEXT,
    "simulateFailure" BOOLEAN NOT NULL DEFAULT false,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationOutboxEvent" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "externalMessageId" TEXT,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_period_key" ON "PayrollRun"("period");

-- CreateIndex
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");

-- CreateIndex
CREATE INDEX "Payslip_userId_period_idx" ON "Payslip"("userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_runId_userId_key" ON "Payslip"("runId", "userId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_userId_period_idx" ON "PayrollAdjustment"("userId", "period");

-- CreateIndex
CREATE INDEX "PayrollWpsExport_runId_idx" ON "PayrollWpsExport"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_provider_key" ON "IntegrationConfig"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationOutboxEvent_idempotencyKey_key" ON "IntegrationOutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "IntegrationOutboxEvent_provider_status_idx" ON "IntegrationOutboxEvent"("provider", "status");

-- CreateIndex
CREATE INDEX "IntegrationOutboxEvent_resourceId_idx" ON "IntegrationOutboxEvent"("resourceId");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollWpsExport" ADD CONSTRAINT "PayrollWpsExport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

