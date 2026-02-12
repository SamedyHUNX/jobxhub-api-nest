import { pgEnum } from "drizzle-orm/pg-core";

export const intervalEnum = pgEnum('stripe_subscription_interval', ['month', 'year']);
export const statusEnum = pgEnum('stripe_subscription_status', [
    'active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid'
]);
export const planEnum = pgEnum('stripe_subscription_plan', ['basic', 'growth', 'enterprise']);
const plans = ['basic', 'growth', 'enterprise'] as const;
export type SubscriptionPlanName = typeof plans[number];

export type SubscriptionInterval = typeof intervalEnum.enumValues[number]; // 'month' | 'year'

export enum PlanName {
    BASIC = 'basic',
    GROWTH = 'growth',
    ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
    ACTIVE = 'active',
    CANCELED = 'canceled',
    PAST_DUE = 'past_due',
    UNPAID = 'unpaid',
    TRIALING = 'trialing',
    INCOMPLETE = 'incomplete',
    INCOMPLETE_EXPIRED = 'incomplete_expired',
}

export enum BillingInterval {
    MONTH = 'month',
    YEAR = 'year',
}