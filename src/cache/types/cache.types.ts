import { planEnum } from "@/stripe/types/stripe.enums";


export interface SubscriptionItem {
    id: string;
    priceId: string;
    price: string;
    quantity: number;
}

export type CachedPlanName = (typeof planEnum.enumValues)[number];

export interface Subscription {
    id: string;
    userId: string;
    planName: CachedPlanName;
    status: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    currentPeriodStart: Date | string;
    currentPeriodEnd: Date | string;
    cancelAtPeriodEnd: boolean;
    canceledAt?: Date | string | null;
    trialStart?: Date | string | null;
    trialEnd?: Date | string | null;
    items?: SubscriptionItem[];
    metadata?: Record<string, string>;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface CachedUser {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    imageUrl?: string;
    userRole: string;
    tokenVersion?: number;
    hasSubscription?: boolean;
    subscription?: Subscription;
}