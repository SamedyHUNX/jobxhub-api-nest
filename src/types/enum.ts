// import { SubscriptionPlans } from '@/permissions/utils/subscription-plans'; // REMOVED CIRCULAR DEP
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

// Stripe Subscription
export const planEnum = pgEnum('stripe_subscription_plan', ['basic', 'growth', 'enterprise']);
export const intervalEnum = pgEnum('stripe_subscription_interval', ['month', 'year']);
export const statusEnum = pgEnum('stripe_subscription_status', [
    'active',
    'canceled',
    'past_due',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'unpaid'
]);
export type SubscriptionPlanName = typeof planEnum.enumValues[number]; // 'basic' | 'growth' | 'enterprise'
export type SubscriptionInterval = typeof intervalEnum.enumValues[number]; // 'month' | 'year'
export type SubscriptionStatus = typeof statusEnum.enumValues[number];