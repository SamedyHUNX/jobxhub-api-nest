import Stripe from "stripe";

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

export interface StripeConfig {
    secretKey: string;
    webhookSecret: string;
    priceIds: {
        [key in PlanName]: {
            monthly: string;
            yearly: string;
        };
    };
}

export interface ExpandedInvoice extends Stripe.Invoice {
    subscription?: string | Stripe.Subscription;
    payment_intent?: string | Stripe.PaymentIntent | null;
}