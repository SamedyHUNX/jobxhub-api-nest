import { uuid, timestamp } from 'drizzle-orm/pg-core';

export const idCol = () => uuid().primaryKey().defaultRandom();

export const createdAtCol = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const updatedAtCol = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
