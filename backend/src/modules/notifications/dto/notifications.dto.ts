import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { NotificationType, DevicePlatform } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Target recipient user ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({ description: 'Triggering actor user ID' })
  @IsString()
  @IsOptional()
  actorId?: string;

  @ApiProperty({ enum: NotificationType, default: NotificationType.SYSTEM })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiProperty({ description: 'English notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Arabic notification title' })
  @IsString()
  @IsOptional()
  titleAr?: string;

  @ApiProperty({ description: 'English notification body' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ description: 'Arabic notification body' })
  @IsString()
  @IsOptional()
  bodyAr?: string;

  @ApiPropertyOptional({ description: 'Structured action metadata / deep links' })
  @IsObject()
  @IsOptional()
  dataJson?: Record<string, any>;
}

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'Expo or APNs/FCM push token string' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({ enum: DevicePlatform, default: DevicePlatform.IOS })
  @IsEnum(DevicePlatform)
  @IsOptional()
  platform?: DevicePlatform;
}

export class NotificationQueryDto {
  @ApiPropertyOptional({ description: 'Filter only unread notifications' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Maximum items to return', default: 20 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 20))
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Number of items to skip', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 0))
  offset?: number = 0;
}

export class MissingAttendanceReminderDto {
  @ApiPropertyOptional({ description: 'Target date in YYYY-MM-DD (defaults to today in Asia/Riyadh)' })
  @IsString()
  @IsOptional()
  dateIso?: string;
}

export class HrDocumentRequestDto {
  @ApiProperty({ description: 'Target employee user ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Requested document type (e.g., IQAMA, PASSPORT, MEDICAL_CERTIFICATE, CONTRACT)' })
  @IsString()
  @IsNotEmpty()
  documentType: string;

  @ApiProperty({ description: 'Instructions or reason from HR' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Optional due date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  dueDateIso?: string;
}
