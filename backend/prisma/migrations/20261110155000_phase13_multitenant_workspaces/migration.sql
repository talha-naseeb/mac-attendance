-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "WorkspacePlanCode" AS ENUM ('INDIVIDUAL_FREE', 'INDIVIDUAL_PRO', 'BUSINESS_STARTER', 'BUSINESS_GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AuthProviderType" AS ENUM ('LOCAL', 'GOOGLE', 'MICROSOFT', 'APPLE');

-- CreateEnum
CREATE TYPE "SsoProviderType" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "SsoConnectionStatus" AS ENUM ('NOT_CONFIGURED', 'DRAFT', 'VERIFIED', 'ERROR');

-- CreateEnum
CREATE TYPE "LeaveApprovalPolicy" AS ENUM ('MANAGER_ONLY', 'MANAGER_THEN_HR');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL DEFAULT 'BUSINESS',
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'SA',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "logoUrl" TEXT,
    "planCode" "WorkspacePlanCode" NOT NULL DEFAULT 'BUSINESS_GROWTH',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "leaveApprovalPolicy" "LeaveApprovalPolicy" NOT NULL DEFAULT 'MANAGER_THEN_HR',
    "ownerMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "employeeId" TEXT,
    "jobTitle" TEXT,
    "titleAr" TEXT,
    "department" TEXT,
    "departmentAr" TEXT,
    "branchId" TEXT,
    "basicSalarySar" DOUBLE PRECISION NOT NULL DEFAULT 10000.0,
    "housingAllowanceSar" DOUBLE PRECISION NOT NULL DEFAULT 2500.0,
    "transportAllowanceSar" DOUBLE PRECISION NOT NULL DEFAULT 1000.0,
    "isRemoteAllowed" BOOLEAN NOT NULL DEFAULT false,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "managedBySsoGroup" TEXT,
    "reportsToMembershipId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProviderType" NOT NULL DEFAULT 'LOCAL',
    "providerAccountId" TEXT NOT NULL,
    "emailAtProvider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsoConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "SsoProviderType" NOT NULL DEFAULT 'MICROSOFT',
    "domain" TEXT,
    "tenantId" TEXT,
    "clientId" TEXT,
    "clientSecretMasked" TEXT,
    "enforced" BOOLEAN NOT NULL DEFAULT false,
    "autoProvision" BOOLEAN NOT NULL DEFAULT false,
    "allowHrGroupMapping" BOOLEAN NOT NULL DEFAULT false,
    "defaultRole" "MembershipRole" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "SsoConnectionStatus" NOT NULL DEFAULT 'DRAFT',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsoGroupMapping" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "providerGroupId" TEXT NOT NULL,
    "providerGroupName" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoGroupMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'EMPLOYEE',
    "jobTitle" TEXT,
    "department" TEXT,
    "reportsToMembershipId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedByMembershipId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'STRIPE',
    "externalCustomerId" TEXT,
    "seatsPurchased" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_type_status_idx" ON "Workspace"("type", "status");

-- CreateIndex
CREATE INDEX "Workspace_planCode_idx" ON "Workspace"("planCode");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_employeeId_key" ON "Membership"("workspaceId", "employeeId");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_role_idx" ON "Membership"("workspaceId", "role");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_status_idx" ON "Membership"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerAccountId_key" ON "AuthIdentity"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnection_workspaceId_key" ON "SsoConnection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoGroupMapping_workspaceId_providerGroupId_key" ON "SsoGroupMapping"("workspaceId", "providerGroupId");

-- CreateIndex
CREATE INDEX "SsoGroupMapping_workspaceId_idx" ON "SsoGroupMapping"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_workspaceId_email_idx" ON "Invite"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Invite_workspaceId_acceptedAt_revokedAt_idx" ON "Invite"("workspaceId", "acceptedAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_reportsToMembershipId_fkey" FOREIGN KEY ("reportsToMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConnection" ADD CONSTRAINT "SsoConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoGroupMapping" ADD CONSTRAINT "SsoGroupMapping_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedByMembershipId_fkey" FOREIGN KEY ("invitedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
