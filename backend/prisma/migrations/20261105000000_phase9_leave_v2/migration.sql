-- AlterEnum
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'SICK_ON_FILE';
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'EMERGENCY_LEAVE';

-- AlterEnum
ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "LeaveStage" AS ENUM ('STAGE_1_MANAGER', 'STAGE_2_HR', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "LeaveLedgerEntryType" AS ENUM ('ACCRUAL', 'USAGE', 'ADJUSTMENT', 'CARRYOVER', 'CANCELLATION_RESTORE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable LeaveBalance
ALTER TABLE "LeaveBalance" ALTER COLUMN "totalDays" TYPE DOUBLE PRECISION;
ALTER TABLE "LeaveBalance" ALTER COLUMN "usedDays" TYPE DOUBLE PRECISION;
ALTER TABLE "LeaveBalance" ALTER COLUMN "remainingDays" TYPE DOUBLE PRECISION;
ALTER TABLE "LeaveBalance" ADD COLUMN IF NOT EXISTS "pendingDays" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "LeaveBalance_userId_year_idx" ON "LeaveBalance"("userId", "year");

-- AlterTable LeaveRequest
ALTER TABLE "LeaveRequest" ALTER COLUMN "daysCount" TYPE DOUBLE PRECISION;
ALTER TABLE "LeaveRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING_MANAGER';
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "isHalfDay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "halfDayPeriod" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "stage" "LeaveStage" NOT NULL DEFAULT 'STAGE_1_MANAGER';
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "routedDirectlyToHr" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "managerReviewedById" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "managerReviewedAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "managerComments" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "hrReviewedById" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "hrReviewedAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "hrComments" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

-- Foreign Keys for LeaveRequest reviewers
DO $$ BEGIN
    ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_managerReviewedById_fkey" FOREIGN KEY ("managerReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_hrReviewedById_fkey" FOREIGN KEY ("hrReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "LeaveRequest_stage_idx" ON "LeaveRequest"("stage");
CREATE INDEX IF NOT EXISTS "LeaveRequest_startDate_endDate_idx" ON "LeaveRequest"("startDate", "endDate");

-- CreateTable LeaveBalanceLedger
CREATE TABLE IF NOT EXISTS "LeaveBalanceLedger" (
    "id" TEXT NOT NULL,
    "balanceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "entryType" "LeaveLedgerEntryType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "requestId" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveBalanceLedger_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys for LeaveBalanceLedger
DO $$ BEGIN
    ALTER TABLE "LeaveBalanceLedger" ADD CONSTRAINT "LeaveBalanceLedger_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "LeaveBalance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "LeaveBalanceLedger" ADD CONSTRAINT "LeaveBalanceLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "LeaveBalanceLedger" ADD CONSTRAINT "LeaveBalanceLedger_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "LeaveBalanceLedger" ADD CONSTRAINT "LeaveBalanceLedger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "LeaveBalanceLedger_userId_leaveType_idx" ON "LeaveBalanceLedger"("userId", "leaveType");
CREATE INDEX IF NOT EXISTS "LeaveBalanceLedger_balanceId_idx" ON "LeaveBalanceLedger"("balanceId");

-- CreateTable CompanyHoliday
CREATE TABLE IF NOT EXISTS "CompanyHoliday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "dateIso" TEXT NOT NULL,
    "isOffDay" BOOLEAN NOT NULL DEFAULT true,
    "country" TEXT NOT NULL DEFAULT 'SA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyHoliday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyHoliday_dateIso_key" ON "CompanyHoliday"("dateIso");
CREATE INDEX IF NOT EXISTS "CompanyHoliday_dateIso_idx" ON "CompanyHoliday"("dateIso");
