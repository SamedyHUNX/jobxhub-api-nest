import { ConfigService } from "@/common/services/config.service";
import { SubscriptionPlan, SubscriptionPlanName, SubscriptionPlans } from "@/permissions/utils/subscription-plans";
import { Injectable } from "@nestjs/common";

@Injectable()
export class StripePermissionsService {
    constructor(
        private configService: ConfigService
    ) { }

    // Get plan by Stripe Price ID
    getPlanByPriceId(priceId: string): {
        planName: SubscriptionPlanName;
        plan: SubscriptionPlan;
        interval: 'monthly' | 'annual';
    } | null {
        for (const [planName, plan] of Object.entries(SubscriptionPlans)) {
            if (plan.stripePriceIdMonthly === priceId) {
                return {
                    planName: planName as SubscriptionPlanName,
                    plan,
                    interval: 'monthly',
                };
            }
            if (plan.stripePriceIdAnnual === priceId) {
                return {
                    planName: planName as SubscriptionPlanName,
                    plan,
                    interval: 'annual',
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
