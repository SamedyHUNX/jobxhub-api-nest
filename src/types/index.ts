import { Request } from 'express';
import { applicationStages, experienceLevels, jobListingStatuses, jobListingTypes, locationRequirements, wageIntervals } from './enum';

export interface User {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
    userRole: string;
    phoneNumber: string;
    dateOfBirth: string;
    createdAt: string;
    updatedAt: string;
}

export interface UserSubscription {
    id: string;
    userId: string;
    planName: string;
    status: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    interval: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    trialStart?: string;
    trialEnd?: string;
    canceledAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface RawBodyRequest<T extends Request = Request> extends Request {
    rawBody: Buffer;
}

// Derived union types (always match arrays above)
export type WageInterval = (typeof wageIntervals)[number];
export type LocationRequirement = (typeof locationRequirements)[number];
export type ExperienceLevel = (typeof experienceLevels)[number];
export type JobListingStatus = (typeof jobListingStatuses)[number];
export type JobListingType = (typeof jobListingTypes)[number];
export type ApplicationStage = (typeof applicationStages)[number];