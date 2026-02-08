import { Injectable } from "@nestjs/common";
import { ConfigService } from "@/common/services/config.service";
import { SubscriptionPlans } from "@/permissions/utils/subscription-plans";
import { SubscriptionInterval, SubscriptionPlan, SubscriptionPlanName } from "@/types/enum";

@Injectable()
export class StripePermissionsService {
    constructor(
        private configService: ConfigService
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
