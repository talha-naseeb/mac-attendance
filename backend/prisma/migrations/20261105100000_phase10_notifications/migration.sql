-- CreateEnum NotificationType
DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM ('LEAVE_REQUEST', 'LEAVE_STAGE_1_APPROVED', 'LEAVE_APPROVAL', 'LEAVE_REJECTION', 'LEAVE_CANCELLED', 'ATTENDANCE_ALERT', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum DevicePlatform
DO $$ BEGIN
    CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "body" TEXT NOT NULL,
    "bodyAr" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "dataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable DeviceToken
CREATE TABLE IF NOT EXISTS "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'IOS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- Unique index on DeviceToken.token
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_token_key" ON "DeviceToken"("token");

-- Indexes on Notification
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- Indexes on DeviceToken
CREATE INDEX IF NOT EXISTS "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- Foreign Keys
DO $$ BEGIN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
