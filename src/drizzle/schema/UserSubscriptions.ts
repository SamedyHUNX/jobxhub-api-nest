import { createdAtCol, updatedAtCol } from "@/utils/helpers";
import { uuid, pgTable, varchar, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { intervalEnum, planEnum, statusEnum } from "@/types/enum";
import { UserTable } from "./User";
import { relations } from "drizzle-orm";

export const UserSubscriptionsTable = pgTable('user_subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => UserTable.id, { onDelete: 'cascade' }),
    planName: planEnum('plan_name').notNull(),
    status: statusEnum('status').notNull(),
    interval: intervalEnum('interval').notNull(),
    stripeCustomerId: varchar('stripe_customer_id').notNull(),
    stripeSubscriptionId: varchar('stripe_subscription_id').notNull(),
    stripePriceId: varchar('stripe_price_id').notNull(), // Managing pricing
    currentPeriodStart: timestamp('current_period_start').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    canceledAt: timestamp('canceled_at'),
    trialStart: timestamp('trial_start'),
    trialEnd: timestamp('trial_end'),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
}, (table) => ({
    userIdx: index('user_idx').on(table.userId),
    stripeSubUnique: uniqueIndex('stripe_sub_unique').on(table.stripeSubscriptionId),
    stripeCustomerIdx: index('stripe_customer_idx').on(table.stripeCustomerId), // For faster lookups
}));

export const UserSubscriptionRelations = relations(UserSubscriptionsTable, ({ one }) => ({ user: one(UserTable, { fields: [UserSubscriptionsTable.userId], references: [UserTable.id], }), }),);
