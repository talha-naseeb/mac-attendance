import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRemoteRequestDto {
  @ApiProperty({ example: '2026-11-05', description: 'Start date in YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDateIso must be YYYY-MM-DD' })
  @IsNotEmpty()
  startDateIso: string;

  @ApiProperty({ example: '2026-11-05', description: 'End date in YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDateIso must be YYYY-MM-DD' })
  @IsNotEmpty()
  endDateIso: string;

  @ApiProperty({ example: 'Working from home due to bad weather/road maintenance' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export enum RemoteRequestDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class DecideRemoteRequestDto {
  @ApiProperty({ enum: RemoteRequestDecision, example: RemoteRequestDecision.APPROVED })
  @IsEnum(RemoteRequestDecision)
  @IsNotEmpty()
  decision: RemoteRequestDecision;

  @ApiPropertyOptional({ example: 'Approved for required date' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
