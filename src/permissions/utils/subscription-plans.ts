export const SubscriptionPlans = {
    BASIC: {
        name: 'Basic',
        description: 'Perfect for small teams starting out',
        priceMonthly: 10,
        priceAnnual: 100,
        stripePriceIdMonthly: process.env.STRIPE_BASIC_MONTHLY_PRICE_ID,
        stripePriceIdAnnual: process.env.STRIPE_BASIC_ANNUAL_PRICE_ID,
        limits: {
            jobPostings: 5,
            featuredListings: 0,
        },
        allowedRoles: ['APPLICANT_MANAGER'],
        features: [
            '5 job postings',
            'Applicant management',
            'Basic analytics',
        ],
    },
    GROWTH: {
        name: 'Growth',
        description: 'For growing companies',
        priceMonthly: 25,
        priceAnnual: 200,
        stripePriceIdMonthly: process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID,
        stripePriceIdAnnual: process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID,
        limits: {
            jobPostings: 10,
            featuredListings: 3,
        },
        allowedRoles: ['APPLICANT_MANAGER', 'JOB_LISTING_MANAGER'],
        features: [
            '10 job postings',
            '3 featured listings',
            'Advanced applicant management',
            'Job listing management',
        ],
    },
    ENTERPRISE: {
        name: 'Enterprise',
        description: 'For large organizations',
        priceMonthly: 100,
        priceAnnual: 1000,
        stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
        stripePriceIdAnnual: process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID,
        limits: {
            jobPostings: 15,
            featuredListings: Infinity,
        },
        allowedRoles: ['OWNER', 'ORG_ADMIN', 'APPLICANT_MANAGER', 'JOB_LISTING_MANAGER'],
        features: [
            '15 job postings',
            'Unlimited featured listings',
            'Full team management',
            'Priority support',
            'Custom integrations',
        ],
    },
} as const;

export type SubscriptionPlanName = keyof typeof SubscriptionPlans;
export type SubscriptionPlan = typeof SubscriptionPlans[SubscriptionPlanName];

// Helper function to get plan by Stripe Price ID
export function getPlanByPriceId(priceId: string): {
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

// Helper to check if user can perform action based on limits
export function canPerformAction(
    plan: SubscriptionPlanName,
    action: 'jobPostings' | 'featuredListings',
    currentCount: number,
): boolean {
    const limit = SubscriptionPlans[plan].limits[action];
    return currentCount < limit;
}

// Helper to check if role is allowed in plan
export function isRoleAllowed(plan: SubscriptionPlanName, role: any): boolean {
    return SubscriptionPlans[plan].allowedRoles.includes(role);
}
