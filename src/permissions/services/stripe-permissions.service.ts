import { Injectable } from "@nestjs/common";
import { SubscriptionInterval, SubscriptionPlanName } from "@/types/enum";
import { SubscriptionPlan, SubscriptionPlans } from "@/stripe/types/subscription-plans";


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
        for (const [key, plan] of Object.entries(SubscriptionPlans)) {
            if (plan.stripePriceIdMonthly === priceId) {
                return {
                    planName: key.toLowerCase() as SubscriptionPlanName,
                    plan,
                    interval: 'month',
                };
            }
            if (plan.stripePriceIdAnnual === priceId) {
                return {
                    planName: key.toLowerCase() as SubscriptionPlanName,
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
        const limit = SubscriptionPlans[plan].limits[action];
        return currentCount < limit;
    }

    isRoleAllowed(plan: SubscriptionPlanName, role: string): boolean {
        return SubscriptionPlans[plan].allowedRoles.includes(role as any);
    }
}
