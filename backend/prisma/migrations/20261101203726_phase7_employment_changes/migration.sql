-- CreateEnum
CREATE TYPE "EmploymentChangeType" AS ENUM ('TRANSFER', 'PROMOTION', 'SALARY', 'ROLE', 'MANAGER', 'REMOTE_ELIGIBILITY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "remoteGrantedAt" TIMESTAMP(3),
ADD COLUMN     "remoteGrantedById" TEXT;

-- CreateTable
CREATE TABLE "EmploymentChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EmploymentChangeType" NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "beforeJson" JSONB NOT NULL,
    "afterJson" JSONB NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalaryRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "basicSalarySar" DOUBLE PRECISION NOT NULL,
    "housingAllowanceSar" DOUBLE PRECISION NOT NULL,
    "transportAllowanceSar" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "changeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSalaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmploymentChange_userId_effectiveDate_idx" ON "EmploymentChange"("userId", "effectiveDate");

-- CreateIndex
CREATE INDEX "EmploymentChange_type_effectiveDate_idx" ON "EmploymentChange"("type", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSalaryRecord_changeId_key" ON "EmployeeSalaryRecord"("changeId");

-- CreateIndex
CREATE INDEX "EmployeeSalaryRecord_userId_effectiveFrom_idx" ON "EmployeeSalaryRecord"("userId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_remoteGrantedById_fkey" FOREIGN KEY ("remoteGrantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentChange" ADD CONSTRAINT "EmploymentChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentChange" ADD CONSTRAINT "EmploymentChange_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryRecord" ADD CONSTRAINT "EmployeeSalaryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryRecord" ADD CONSTRAINT "EmployeeSalaryRecord_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "EmploymentChange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

