import { createdAtCol, idCol, updatedAtCol } from "@/utils/helpers";
import { uuid, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { OrganizationTable } from "./Organizations";
import { relations } from "drizzle-orm";

export const OrganizationSubscriptionsTable = pgTable('organization_subscriptions', {
    id: idCol(),
    organizationId: uuid('organization_id')
        .notNull()
        .references(() => OrganizationTable.id, { onDelete: 'cascade' }),
    plan: varchar('plan').notNull(), // BASIC, GROWTH, ENTERPRISE
    status: varchar('status').notNull(), // active, canceled, past_due
    stripeCustomerId: varchar('stripe_customer_id'),
    stripeSubscriptionId: varchar('stripe_subscription_id'),
    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at'),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
});

export const OrganizationSubscriptionRelations = relations(OrganizationSubscriptionsTable, ({ one }) => ({ organization: one(OrganizationTable, { fields: [OrganizationSubscriptionsTable.organizationId], references: [OrganizationTable.id], }), }),);
