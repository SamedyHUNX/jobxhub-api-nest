import { createdAtCol, idCol, updatedAtCol } from "@/utils/helpers";
import { uuid, pgTable, varchar, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { UserTable } from "./User";
import { relations } from "drizzle-orm";
import { intervalEnum, planEnum, statusEnum } from "@/stripe/types/subscription-plans";

export const UserSubscriptionsTable = pgTable('user_subscriptions', {
    id: idCol(),
    userId: uuid('user_id')
        .notNull()
        .references(() => UserTable.id, { onDelete: 'cascade' }),
    planName: planEnum('plan_name').notNull(),
    status: statusEnum('status').notNull(),
    interval: intervalEnum('interval').notNull(),
    stripeCustomerId: varchar('stripe_customer_id').notNull(),
    stripeSubscriptionId: varchar('stripe_subscription_id').notNull(),
    stripePriceId: varchar('stripe_price_id').notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    trialStart: timestamp('trial_start', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
}, (table) => ({
    userIdx: index('user_idx').on(table.userId),
    stripeSubUnique: uniqueIndex('stripe_sub_unique').on(table.stripeSubscriptionId),
    stripeCustomerIdx: index('stripe_customer_idx').on(table.stripeCustomerId), // For faster lookups
}));

export const UserSubscriptionRelations = relations(UserSubscriptionsTable, ({ one }) => ({ user: one(UserTable, { fields: [UserSubscriptionsTable.userId], references: [UserTable.id], }), }),);
