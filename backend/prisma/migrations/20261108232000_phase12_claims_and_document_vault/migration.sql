-- CreateEnum
CREATE TYPE "ClaimCategory" AS ENUM ('MEDICAL', 'INSURANCE', 'PETROL', 'WIFI');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClaimStage" AS ENUM ('STAGE_1_MANAGER', 'STAGE_2_HR', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NATIONAL_ID_IQAMA', 'PASSPORT', 'MEDICAL_INSURANCE', 'EMPLOYMENT_CONTRACT');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ReimbursementPolicy" (
    "id" TEXT NOT NULL,
    "category" "ClaimCategory" NOT NULL,
    "monthlyCapHalalas" INTEGER NOT NULL,
    "annualCapHalalas" INTEGER NOT NULL,
    "requiresReceipt" BOOLEAN NOT NULL DEFAULT true,
    "allowDirectToHr" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "ClaimCategory" NOT NULL,
    "period" TEXT NOT NULL,
    "amountHalalas" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "description" TEXT NOT NULL,
    "receiptUrl" TEXT NOT NULL,
    "receiptFileName" TEXT,
    "exceedsCap" BOOLEAN NOT NULL DEFAULT false,
    "isPrivateMedical" BOOLEAN NOT NULL DEFAULT false,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING_MANAGER',
    "stage" "ClaimStage" NOT NULL DEFAULT 'STAGE_1_MANAGER',
    "routedDirectlyToHr" BOOLEAN NOT NULL DEFAULT false,
    "managerReviewedById" TEXT,
    "managerReviewedAt" TIMESTAMP(3),
    "managerComments" TEXT,
    "hrReviewedById" TEXT,
    "hrReviewedAt" TIMESTAMP(3),
    "hrComments" TEXT,
    "payrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "documentNumber" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "issuedDateIso" TEXT,
    "expiryDateIso" TEXT,
    "status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementPolicy_category_key" ON "ReimbursementPolicy"("category");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_userId_period_idx" ON "ReimbursementClaim"("userId", "period");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_status_stage_idx" ON "ReimbursementClaim"("status", "stage");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_payrollRunId_idx" ON "ReimbursementClaim"("payrollRunId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_userId_documentType_idx" ON "EmployeeDocument"("userId", "documentType");

-- CreateIndex
CREATE INDEX "EmployeeDocument_status_idx" ON "EmployeeDocument"("status");

-- CreateIndex
CREATE INDEX "EmployeeDocument_expiryDateIso_idx" ON "EmployeeDocument"("expiryDateIso");

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_managerReviewedById_fkey" FOREIGN KEY ("managerReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_hrReviewedById_fkey" FOREIGN KEY ("hrReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
