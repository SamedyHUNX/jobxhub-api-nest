import { Injectable } from "@nestjs/common";
import { getSubscriptionPlans, SubscriptionInterval, SubscriptionPlan, SubscriptionPlanName } from "@/stripe/types/subscription-plans";


@Injectable()
export class StripePermissionsService {
    constructor(
    ) { }
    // Get plan by Stripe Price ID
    getPlanByPriceId(priceId: string): {
        planName: SubscriptionPlanName;
        plan: SubscriptionPlan;
        interval: SubscriptionInterval;
    } | null {
        const plans = getSubscriptionPlans();
        for (const [key, plan] of Object.entries(plans)) {
            if (plan.stripePriceIdMonthly === priceId) {
                return {
                    planName: key as SubscriptionPlanName,
                    plan,
                    interval: 'month',
                };
            }
            if (plan.stripePriceIdAnnual === priceId) {
                return {
                    planName: key as SubscriptionPlanName,
                    plan,
                    interval: 'year',
                };
            }
        }
        return null;
    }

    canPerformAction(
        plan: SubscriptionPlanName,
        action: 'jobPostings' | 'featuredListings',
        currentCount: number,
    ): boolean {
        const plans = getSubscriptionPlans();
        const limit = plans[plan].limits[action];
        return currentCount < limit;
    }

    isRoleAllowed(plan: SubscriptionPlanName, role: string): boolean {
        const plans = getSubscriptionPlans();
        return plans[plan].allowedRoles.includes(role as any);
    }
}
