import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExceptionReviewDecision {
  ACCEPTED = 'ACCEPTED',
  ESCALATED = 'ESCALATED',
}

export class ReviewExceptionDto {
  @ApiProperty({ enum: ExceptionReviewDecision, example: ExceptionReviewDecision.ACCEPTED })
  @IsEnum(ExceptionReviewDecision)
  @IsNotEmpty()
  decision: ExceptionReviewDecision;

  @ApiPropertyOptional({ example: 'Verified with manager that employee had to leave premises early' })
  @IsString()
  @IsOptional()
  reviewNote?: string;
}
