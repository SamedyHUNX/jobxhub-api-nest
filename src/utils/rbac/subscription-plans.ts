export const SubscriptionPlans = {
    BASIC: {
        priceMonthly: 10,
        priceAnnual: 80,
        limits: {
            jobPostings: 5,
            featuredListings: 0,
        },
        allowedRoles: ['APPLICANT_MANAGER'],
    },
    GROWTH: {
        priceMonthly: 20,
        priceAnnual: 180,
        limits: {
            jobPostings: 10,
            featuredListings: 3,
        },
        allowedRoles: ['APPLICANT_MANAGER', 'JOB_LISTING_MANAGER'],
    },
    ENTERPRISE: {
        priceMonthly: 100,
        priceAnnual: 800,
        limits: {
            jobPostings: 15,
            featuredListings: Infinity,
        },
        allowedRoles: ['OWNER', 'ORG_ADMIN', 'APPLICANT_MANAGER', 'JOB_LISTING_MANAGER'],
    },
} as const;
