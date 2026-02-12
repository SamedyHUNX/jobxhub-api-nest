import { Injectable } from "@nestjs/common";
import { getSubscriptionPlans } from "@/stripe/types/subscription-plans";
import { SubscriptionPlanName } from "@/stripe/types/stripe.enums";

@Injectable()
export class StripePermissionsService {
    constructor() { }

    /**
     * Check if subscription is currently active and valid
     */
    isSubscriptionActive(subscription: {
        status: string;
        currentPeriodEnd: Date;
        canceledAt?: Date | null;
        trialEnd?: Date | null;
    }): boolean {
        const now = new Date();

        // Check basic status
        const validStatuses = ['active', 'trialing'];
        if (!validStatuses.includes(subscription.status)) {
            return false;
        }

        // Check if current period has ended
        if (subscription.currentPeriodEnd < now) {
            return false;
        }

        // If in trial, check trial hasn't ended
        if (subscription.status === 'trialing' && subscription.trialEnd) {
            if (subscription.trialEnd < now) {
                return false;
            }
        }

        // If canceled, check if cancellation is immediate
        if (subscription.canceledAt && subscription.canceledAt < now) {
            return false;
        }

        return true;
    }

    /**
     * Check if user can perform an action based on their plan and current usage
     */
    canPerformAction(
        subscription: {
            planName: SubscriptionPlanName;
            status: string;
            currentPeriodEnd: Date;
            canceledAt?: Date | null;
            trialEnd?: Date | null;
        },
        action: 'jobPostings' | 'featuredListings' | 'organizations',
        currentCount: number,
    ): boolean {
        // First check if subscription is active
        if (!this.isSubscriptionActive(subscription)) {
            return false;
        }

        // Then check plan limits
        const plans = getSubscriptionPlans();
        const limit = plans[subscription.planName].limits[action];

        // Handle unlimited (-1) plans
        if (limit === Infinity) {
            return true;
        }

        return currentCount < limit;
    }

    /**
     * Check if a role is allowed for the subscription plan
     */
    isRoleAllowed(
        subscription: {
            planName: SubscriptionPlanName;
            status: string;
            currentPeriodEnd: Date;
            canceledAt?: Date | null;
            trialEnd?: Date | null;
        },
        role: string,
    ): boolean {
        // First check if subscription is active
        if (!this.isSubscriptionActive(subscription)) {
            return false;
        }

        // Then check role permissions
        const plans = getSubscriptionPlans();
        return plans[subscription.planName].allowedRoles.includes(role as any);
    }

    /**
     * Get the reason why a subscription is inactive (for user messaging)
     */
    getInactiveReason(subscription: {
        status: string;
        currentPeriodEnd: Date;
        canceledAt?: Date | null;
        trialEnd?: Date | null;
    }): string | null {
        const now = new Date();

        if (subscription.status === 'canceled') {
            return 'Subscription has been canceled';
        }

        if (subscription.currentPeriodEnd < now) {
            return 'Subscription period has ended';
        }

        if (subscription.status === 'trialing' && subscription.trialEnd && subscription.trialEnd < now) {
            return 'Trial period has ended';
        }

        if (subscription.canceledAt && subscription.canceledAt < now) {
            return 'Subscription was canceled';
        }

        if (!['active', 'trialing'].includes(subscription.status)) {
            return `Subscription status is ${subscription.status}`;
        }

        return null;
    }
}
