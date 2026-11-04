import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
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

  @ApiProperty({ example: 24.7136, description: 'Latitude between -90 and 90' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 46.6753, description: 'Longitude between -180 and 180' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({ example: 150, default: 150, description: 'Geofence radius between 10m and 10000m' })
  @IsNumber()
  @Min(10)
  @Max(10000)
  @IsOptional()
  geofenceRadiusMeters?: number;

  @ApiPropertyOptional({ example: 'Digital City, Building 4B, Riyadh, KSA' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: ['00:11:22:33:44:55'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  wifiBssids?: string[];

  @ApiPropertyOptional({ example: ['beacon-uuid-1'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  bleBeacons?: string[];

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Riyadh HQ' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'المقر الرئيسي' })
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'Riyadh' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'الرياض' })
  @IsString()
  @IsOptional()
  cityAr?: string;

  @ApiPropertyOptional({ example: 24.7136 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 46.6753 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsNumber()
  @Min(10)
  @Max(10000)
  @IsOptional()
  geofenceRadiusMeters?: number;

  @ApiPropertyOptional({ example: 'Digital City, Riyadh' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: ['00:11:22:33:44:55'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  wifiBssids?: string[];

  @ApiPropertyOptional({ example: ['beacon-uuid-1'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  bleBeacons?: string[];

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
