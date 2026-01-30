import { pgEnum } from 'drizzle-orm/pg-core';

// JobListings
export const wageIntervals = ['hourly', 'yearly', 'monthly', 'weekly'] as const;
export const locationRequirements = ['in-office', 'hybrid', 'remote'] as const;
export const experienceLevels = [
  'junior',
  'mid',
  'senior',
  'lead',
  'manager',
  'ceo',
  'director',
] as const;
export const jobListingStatuses = ['draft', 'published', 'delisted'] as const;
export const jobListingTypes = [
  'internship',
  'part-time',
  'full-time',
  'freelance',
  'contract',
] as const;

export const wageIntervalEnum = pgEnum(
  'job_listings_wage_interval',
  wageIntervals,
);

export const locationRequirementEnum = pgEnum(
  'job_listings_location_requirement',
  locationRequirements,
);

export const experienceLevelEnum = pgEnum(
  'job_listings_experience_level',
  experienceLevels,
);

export const jobListingStatusEnum = pgEnum(
  'job_listings_status',
  jobListingStatuses,
);

export const jobListingTypeEnum = pgEnum('job_listings_type', jobListingTypes);

// JobListingApplication
export const applicationStages = [
  'denied',
  'applied',
  'interviewed',
  'hired',
] as const;

export const applicationStageEnum = pgEnum(
  'job_listing_applications_state',
  applicationStages,
);

// Derived union types (always match arrays above)
export type WageInterval = (typeof wageIntervals)[number];
export type LocationRequirement = (typeof locationRequirements)[number];
export type ExperienceLevel = (typeof experienceLevels)[number];
export type JobListingStatus = (typeof jobListingStatuses)[number];
export type JobListingType = (typeof jobListingTypes)[number];
export type ApplicationStage = (typeof applicationStages)[number];
