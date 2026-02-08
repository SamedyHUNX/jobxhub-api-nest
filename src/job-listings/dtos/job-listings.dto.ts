
import {
  IsBoolean,
  IsDateString,
  IsEmpty,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import type { ExperienceLevel, JobListingStatus, JobListingType, LocationRequirement, WageInterval } from '@/types';
import { experienceLevels, jobListingStatuses, jobListingTypes, locationRequirements, wageIntervals } from '@/types/enum';

export class CreateJobListingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(100)
  @MaxLength(5000)
  description: string;

  @IsOptional()
  wage?: string;

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

// Update DTO: all fields optional
export class UpdateJobListingDto extends PartialType(CreateJobListingDto) {
  @IsEmpty()
  id?: string;

  @IsEmpty()
  organizationId?: string;

  @IsEmpty()
  createdAt?: never;

  @IsEmpty()
  updatedAt?: never;
}


