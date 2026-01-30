import {
  wageIntervals,
  locationRequirements,
  experienceLevels,
  jobListingStatuses,
  jobListingTypes,
} from '@/utils/enums';
import type {
  WageInterval,
  LocationRequirement,
  ExperienceLevel,
  JobListingStatus,
  JobListingType,
} from '@/utils/enums';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateJobListingDto {
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(100)
  @MaxLength(5000)
  description: string;

  @IsNumber()
  @IsOptional()
  wage?: number;

  @IsEnum(wageIntervals)
  @IsOptional()
  wageInterval?: WageInterval;

  @IsString()
  @IsOptional()
  stateAbbreviation?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsEnum(locationRequirements)
  @IsNotEmpty()
  locationRequirement: LocationRequirement;

  @IsEnum(experienceLevels)
  @IsNotEmpty()
  experienceLevel: ExperienceLevel;

  @IsEnum(jobListingStatuses)
  @IsOptional()
  status?: JobListingStatus;

  @IsEnum(jobListingTypes)
  @IsNotEmpty()
  type: JobListingType;

  @IsDateString()
  @IsOptional()
  postedAt?: string;
}
