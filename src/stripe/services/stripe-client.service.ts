import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from "@/common/services/config.service"
import { PlanName, BillingInterval } from './../types/stripe.types';
import { SubscriptionPlans } from '@/permissions/utils/subscription-plans';

@Injectable()
export class StripeClientService {
    public readonly client: Stripe;
    private readonly logger = new Logger(StripeClientService.name);

    constructor(private readonly configService: ConfigService) {
        this.client = new Stripe(this.configService.stripeSecretKey, {
            apiVersion: '2026-01-28.clover'
        });
    }

    // Helper to get price ID from your existing config
    getPriceId(planName: PlanName, interval: BillingInterval): string {
        const plan = SubscriptionPlans[planName];

        return interval === BillingInterval.MONTH
            ? plan.stripePriceIdMonthly
            : plan.stripePriceIdAnnual;
    }

    getPlanNameFromPriceId(priceId: string): PlanName {
        for (const [planName, plan] of Object.entries(SubscriptionPlans)) {
            if (plan.stripePriceIdMonthly === priceId || plan.stripePriceIdAnnual === priceId) {
                return planName as PlanName;
            }
        }
        return PlanName.BASIC;
    }

    getIntervalFromPriceId(priceId: string): BillingInterval {
        for (const plan of Object.values(SubscriptionPlans)) {
            if (plan.stripePriceIdMonthly === priceId) return BillingInterval.MONTH;
            if (plan.stripePriceIdAnnual === priceId) return BillingInterval.YEAR;
        }
        return BillingInterval.MONTH;
    }
}