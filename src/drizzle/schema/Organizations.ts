import { createdAtCol, idCol, updatedAtCol } from '@/utils/helpers';
import { relations } from 'drizzle-orm';
import { integer } from 'drizzle-orm/pg-core';
import { boolean } from 'drizzle-orm/pg-core';
import { varchar } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';
import { JobListingTable } from './JobListings';
import { OrganizationUserSettingsTable } from './OrganizationUserSettings';
import { UserTable } from './User';
import { uuid } from 'drizzle-orm/pg-core';
import { timestamp } from 'drizzle-orm/pg-core';
import { OrganizationSubscriptionsTable } from './OrganizationSubscriptions';

export const OrganizationTable = pgTable('organizations', {
  id: idCol(),
  orgName: varchar('org_name').notNull(),
  imageUrl: varchar('image_url'),
  description: varchar('description'),
  slug: varchar('slug').unique().notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
  isBanned: boolean('is_banned').notNull().default(false),
  membersCount: integer('members_count').notNull().default(0),
  pendingInvitationsCount: integer('pending_invitations_count')
    .notNull()
    .default(0),
  adminDeleteEnabled: boolean('admin_delete_enabled').notNull().default(false),
  maxAllowedMemberships: integer('max_allowed_memberships').default(5),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => UserTable.id, { onDelete: 'restrict' }),
  jobsCount: integer('jobs_count').notNull().default(0),
  subscriptionPlan: varchar('subscription_plan').notNull().default('BASIC'), // BASIC, GROWTH, ENTERPRISE
  subscriptionStatus: varchar('subscription_status').notNull().default('inactive'), // active, canceled, past_due 
  subscriptionStart: timestamp('subscription_start'),
  subscriptionEnd: timestamp('subscription_end'),
  stripeCustomerId: varchar('stripe_customer_id'), // link to Stripe customer stripeSubscriptionId: varchar('stripe_subscription_id'),
  createdAt: createdAtCol(),
  updatedAt: updatedAtCol(),
});

export const OrganizationRelations = relations(
  OrganizationTable,
  ({ many }) => ({
    jobListings: many(JobListingTable),
    organizationUserSettings: many(OrganizationUserSettingsTable),
    subscriptions: many(OrganizationSubscriptionsTable),
  }),
);
