-- Phase 13 Part B: Add workspaceId scoping across sessions and domain tables

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "AttendanceDay" ADD COLUMN "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "LeaveBalance" ADD COLUMN "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN "workspaceId" TEXT,
ADD COLUMN "membershipId" TEXT;

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "ReimbursementClaim" ADD COLUMN "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "EmployeeDocument" ADD COLUMN "workspaceId" TEXT;

-- CreateIndex
CREATE INDEX "Branch_workspaceId_idx" ON "Branch"("workspaceId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_workspaceId_idx" ON "AttendanceRecord"("workspaceId");

-- CreateIndex
CREATE INDEX "AttendanceDay_workspaceId_dateIso_idx" ON "AttendanceDay"("workspaceId", "dateIso");

-- CreateIndex
CREATE INDEX "LeaveBalance_workspaceId_userId_idx" ON "LeaveBalance"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "LeaveRequest_workspaceId_idx" ON "LeaveRequest"("workspaceId");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_idx" ON "AuditLog"("workspaceId");

-- CreateIndex
CREATE INDEX "AuthSession_workspaceId_userId_idx" ON "AuthSession"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "PayrollRun_workspaceId_idx" ON "PayrollRun"("workspaceId");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_workspaceId_idx" ON "ReimbursementClaim"("workspaceId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_workspaceId_idx" ON "EmployeeDocument"("workspaceId");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDay" ADD CONSTRAINT "AttendanceDay_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
