import { Injectable } from "@nestjs/common";
import { getSubscriptionPlans, SubscriptionPlanName } from "@/stripe/types/subscription-plans";


@Injectable()
export class StripePermissionsService {
    constructor() { }
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
