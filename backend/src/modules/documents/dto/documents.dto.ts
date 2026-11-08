import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentType, DocumentVerificationStatus } from '@prisma/client';

export class UploadDocumentDto {
  @ApiPropertyOptional({
    description:
      'Target employee userId (HR_ADMIN / SUPER_ADMIN can upload on behalf of an employee; defaults to caller)',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    enum: DocumentType,
    example: DocumentType.NATIONAL_ID_IQAMA,
  })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiProperty({ example: 'Saudi National ID / Iqama Card' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: '1033333333' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiProperty({
    example: 'https://storage.shiftly.app/vault/iqama-1033333333.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @ApiPropertyOptional({ example: 'iqama-1033333333.pdf' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'issuedDateIso must be in YYYY-MM-DD format',
  })
  issuedDateIso?: string;

  @ApiPropertyOptional({ example: '2026-12-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'expiryDateIso must be in YYYY-MM-DD format',
  })
  expiryDateIso?: string;
}

export class VerifyDocumentDto {
  @ApiProperty({
    enum: [
      DocumentVerificationStatus.VERIFIED,
      DocumentVerificationStatus.REJECTED,
    ],
    example: DocumentVerificationStatus.VERIFIED,
  })
  @IsEnum(DocumentVerificationStatus)
  status!: DocumentVerificationStatus;

  @ApiPropertyOptional({ example: 'Verified original ID against Absher/Muqeem' })
  @IsOptional()
  @IsString()
  verificationNote?: string;
}

export class ExpiringDocumentsQueryDto {
  @ApiPropertyOptional({
    example: 60,
    description: 'Lookahead window in days for expiring documents (default 60)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  withinDays?: number = 60;
}
