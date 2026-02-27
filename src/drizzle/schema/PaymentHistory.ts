import { pgTable, uuid, varchar, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { UserTable } from "./User";
import { UserSubscriptionsTable } from "./UserSubscriptions";
import { createdAtCol, idCol, updatedAtCol } from "@/utils/date.utils";

export const PaymentHistoryTable = pgTable('payment_history', {
    id: idCol(),
    userId: uuid('user_id')
        .notNull()
        .references(() => UserTable.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id')
        .references(() => UserSubscriptionsTable.id, { onDelete: 'set null' }),
    stripeInvoiceId: varchar('stripe_invoice_id').notNull(),
    stripePaymentIntentId: varchar('stripe_payment_intent_id'),
    amount: integer('amount').notNull(), // in cents
    currency: varchar('currency', { length: 3 }).notNull().default('usd'),
    status: varchar('status').notNull(), // paid, failed, pending
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
}, (table) => ({
    userIdx: index('payment_user_idx').on(table.userId),
    invoiceUnique: uniqueIndex('stripe_invoice_unique').on(table.stripeInvoiceId),
}));