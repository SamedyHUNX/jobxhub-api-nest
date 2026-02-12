export interface SubscriptionPlan {
    name: string;
    description: string;
    priceMonthly: number;
    priceAnnual: number;
    stripePriceIdMonthly: string | undefined;
    stripePriceIdAnnual: string | undefined;
    limits: {
        jobPostings: number;
        featuredListings: number;
        organizations: number;
    };
    allowedRoles: readonly string[];
    features: readonly string[];
}


// subscription-plans.config.ts
export const getSubscriptionPlans = () => ({
    basic: {
        name: 'basic',
        description: 'Perfect for small organizations/companies',
        priceMonthly: 10,
        priceAnnual: 100,
        stripePriceIdMonthly: process.env.STRIPE_BASIC_MONTHLY_PRICE_ID,
        stripePriceIdAnnual: process.env.STRIPE_BASIC_ANNUAL_PRICE_ID,
        limits: {
            jobPostings: 5,
            featuredListings: 0,
            organizations: 1
        },
        allowedRoles: ['APPLICANT_MANAGER'],
        features: [
            '5 job postings',
            'Applicant management',
            'Basic analytics',
        ],
    },
    growth: {
        name: 'growth',
        description: 'For growing organizations/companies',
        priceMonthly: 25,
        priceAnnual: 200,
        stripePriceIdMonthly: process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID,
        stripePriceIdAnnual: process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID,
        limits: {
            jobPostings: 10,
            featuredListings: 3,
            organizations: 5
        },
        allowedRoles: ['APPLICANT_MANAGER', 'JOB_LISTING_MANAGER'],
        features: [
            '10 job postings',
            '3 featured listings',
            'Advanced applicant management',
            'Job listing management',
        ],
    },
    enterprise: {
        name: 'enterprise',
        description: 'For large organizations/companies',
        priceMonthly: 100,
        priceAnnual: 1000,
        stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
        stripePriceIdAnnual: process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID,
        limits: {
            jobPostings: 15,
            featuredListings: Infinity,
            organizations: 10
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
} as const);

