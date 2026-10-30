import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PunchType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
}

export class PunchAttendanceDto {
  @ApiProperty({ enum: PunchType, example: PunchType.CHECK_IN })
  @IsEnum(PunchType)
  @IsNotEmpty()
  type: PunchType;

  @ApiProperty({ example: 24.7136, description: 'GPS Latitude' })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ example: 46.6753, description: 'GPS Longitude' })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({ example: 12.5, description: 'GPS Accuracy radius in meters' })
  @IsNumber()
  @IsNotEmpty()
  accuracyMeters: number;

  @ApiProperty({ example: false, description: 'Mock location mock provider detection flag' })
  @IsBoolean()
  @IsNotEmpty()
  isMockLocation: boolean;

  @ApiProperty({ example: false, description: 'Root/Jailbreak detection flag' })
  @IsBoolean()
  @IsNotEmpty()
  isDeviceRooted: boolean;

  @ApiProperty({ example: true, description: 'Local biometric authentication verified' })
  @IsBoolean()
  @IsNotEmpty()
  biometricVerified: boolean;

  @ApiProperty({ example: '2026-10-24T08:00:00.000Z', description: 'Device local timestamp in ISO format' })
  @IsISO8601()
  @IsNotEmpty()
  clientTimestamp: string;

  @ApiProperty({ example: 'branch-ruh-hq-01', description: 'Assigned or target branch ID' })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiPropertyOptional({ example: 'A4:83:E7:2F:91:C0' })
  @IsString()
  @IsOptional()
  wifiBssid?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether a registered BLE beacon was detected' })
  @IsBoolean()
  @IsOptional()
  bleBeaconDetected?: boolean;

  @ApiPropertyOptional({ enum: ['OFFICE', 'REMOTE'], default: 'OFFICE' })
  @IsEnum(['OFFICE', 'REMOTE'])
  @IsOptional()
  workMode?: 'OFFICE' | 'REMOTE';

  @ApiPropertyOptional({ example: 'Clocked in on time' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class OfflinePunchItemDto {
  @ApiProperty({ example: 'queue-uuid-1234' })
  @IsString()
  @IsNotEmpty()
  queueId: string;

  @ApiProperty({ enum: PunchType, example: PunchType.CHECK_IN })
  @IsEnum(PunchType)
  @IsNotEmpty()
  type: PunchType;

  @ApiProperty({ example: 24.7136 })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ example: 46.6753 })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @IsNotEmpty()
  accuracyMeters: number;

  @ApiProperty({ example: '2026-10-24T08:02:15.000Z' })
  @IsISO8601()
  @IsNotEmpty()
  clientTimestamp: string;

  @ApiProperty({ example: '811c9dc5', description: 'Legacy client checksum; not trusted for server verification' })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({ example: 'branch-ruh-hq-01' })
  @IsString()
  @IsNotEmpty()
  branchId: string;
}

export class SyncOfflinePunchesDto {
  @ApiProperty({ type: [OfflinePunchItemDto] })
  @ValidateNested({ each: true })
  @Type(() => OfflinePunchItemDto)
  punches: OfflinePunchItemDto[];
}
