import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { ClaimCategory } from '@prisma/client';

export class SubmitClaimDto {
  @ApiProperty({ enum: ClaimCategory, example: ClaimCategory.WIFI })
  @IsEnum(ClaimCategory)
  category!: ClaimCategory;

  @ApiPropertyOptional({
    example: '2026-10',
    description: 'Target YYYY-MM payroll period (defaults to current month)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'period must be in YYYY-MM format',
  })
  period?: string;

  @ApiProperty({ example: 350, description: 'Claim amount in SAR (> 0)' })
  @IsNumber()
  @Min(0.01)
  amountSar!: number;

  @ApiProperty({ example: 'Monthly fiber internet bill for remote work' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    example: 'https://storage.shiftly.app/receipts/wifi-oct-2026.pdf',
    description: 'Receipt or medical bill attachment URL/URI',
  })
  @IsString()
  @IsNotEmpty()
  receiptUrl!: string;

  @ApiPropertyOptional({ example: 'wifi-oct-2026.pdf' })
  @IsOptional()
  @IsString()
  receiptFileName?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'For MEDICAL or INSURANCE claims: route directly to HR Admin without exposing medical receipts to the line manager',
  })
  @IsOptional()
  @IsBoolean()
  isPrivateMedical?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, allows submitting an amount above the category cap flagged for HR exception review',
  })
  @IsOptional()
  @IsBoolean()
  requestCapException?: boolean;
}

export class ClaimDecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'], example: 'APPROVED' })
  @IsString()
  @IsNotEmpty()
  decision!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ example: 'Verified receipt against policy cap' })
  @IsOptional()
  @IsString()
  comments?: string;
}

export class UpdateClaimPolicyDto {
  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  monthlyCapSar?: number;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  annualCapSar?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowDirectToHr?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
