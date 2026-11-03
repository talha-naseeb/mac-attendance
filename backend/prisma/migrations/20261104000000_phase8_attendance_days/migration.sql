-- CreateEnum
CREATE TYPE "LocationVerdict" AS ENUM ('INSIDE_OFFICE', 'OUTSIDE_OFFICE', 'INSIDE_DECLARED_ZONE', 'OUTSIDE_DECLARED_ZONE', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "RemoteRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('OUTSIDE_OFFICE_GEOFENCE', 'OUTSIDE_DECLARED_ZONE', 'EXCESSIVE_DISTANCE', 'LATE_DECLARATION', 'LOW_ACCURACY_CHECKOUT', 'UNVERIFIED_CHECKOUT');

-- CreateEnum
CREATE TYPE "ExceptionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'ACCEPTED', 'ESCALATED');

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "capturedAt" TIMESTAMP(3),
ADD COLUMN     "clientEventId" TEXT,
ADD COLUMN     "dayId" TEXT,
ADD COLUMN     "distanceToDeclared" DOUBLE PRECISION,
ADD COLUMN     "lateSubmission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reasonCode" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "verdict" "LocationVerdict";

-- CreateTable
CREATE TABLE "AttendanceDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateIso" TEXT NOT NULL,
    "mode" "WorkMode" NOT NULL DEFAULT 'OFFICE',
    "remoteRequestId" TEXT,
    "declaredLabel" TEXT,
    "declaredLatitude" DOUBLE PRECISION,
    "declaredLongitude" DOUBLE PRECISION,
    "declaredRadiusMeters" DOUBLE PRECISION DEFAULT 500,
    "declaredSource" TEXT,
    "declaredAt" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "firstCheckInAt" TIMESTAMP(3),
    "lastCheckOutAt" TIMESTAMP(3),
    "workingMinutes" INTEGER NOT NULL DEFAULT 0,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "openExceptionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemoteWorkRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDateIso" TEXT NOT NULL,
    "endDateIso" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RemoteRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemoteWorkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceException" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "recordId" TEXT,
    "type" "ExceptionType" NOT NULL,
    "severity" "ExceptionSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "detailsJson" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceDay_dateIso_idx" ON "AttendanceDay"("dateIso");

-- CreateIndex
CREATE INDEX "AttendanceDay_status_idx" ON "AttendanceDay"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDay_userId_dateIso_key" ON "AttendanceDay"("userId", "dateIso");

-- CreateIndex
CREATE INDEX "RemoteWorkRequest_userId_status_idx" ON "RemoteWorkRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "RemoteWorkRequest_status_startDateIso_idx" ON "RemoteWorkRequest"("status", "startDateIso");

-- CreateIndex
CREATE INDEX "SavedLocation_userId_idx" ON "SavedLocation"("userId");

-- CreateIndex
CREATE INDEX "AttendanceException_dayId_idx" ON "AttendanceException"("dayId");

-- CreateIndex
CREATE INDEX "AttendanceException_status_idx" ON "AttendanceException"("status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_dayId_idx" ON "AttendanceRecord"("dayId");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "AttendanceDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDay" ADD CONSTRAINT "AttendanceDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDay" ADD CONSTRAINT "AttendanceDay_remoteRequestId_fkey" FOREIGN KEY ("remoteRequestId") REFERENCES "RemoteWorkRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteWorkRequest" ADD CONSTRAINT "RemoteWorkRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteWorkRequest" ADD CONSTRAINT "RemoteWorkRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedLocation" ADD CONSTRAINT "SavedLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "AttendanceDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AttendanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
