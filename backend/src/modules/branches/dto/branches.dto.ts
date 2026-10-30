import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ example: 'Riyadh HQ - Digital City' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'المقر الرئيسي - المدينة الرقمية، الرياض' })
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiProperty({ example: 'RUH-HQ' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Riyadh' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ example: 'الرياض' })
  @IsString()
  @IsOptional()
  cityAr?: string;

  @ApiProperty({ example: 24.7136 })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ example: 46.6753 })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiPropertyOptional({ example: 150, default: 150 })
  @IsNumber()
  @IsOptional()
  geofenceRadiusMeters?: number;

  @ApiPropertyOptional({ example: 'Digital City, Building 4B, Riyadh, KSA' })
  @IsString()
  @IsOptional()
  address?: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Riyadh HQ' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 24.7136 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 46.6753 })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsNumber()
  @IsOptional()
  geofenceRadiusMeters?: number;
}
