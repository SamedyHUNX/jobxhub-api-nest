import { uuid, timestamp } from 'drizzle-orm/pg-core';

export const idCol = () => uuid().primaryKey().defaultRandom();

export const createdAtCol = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const updatedAtCol = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export function capitalizeString(str: string): string {
  if (!str || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function sanitizedEmail(email: string): string {
  return email ? `${email.substring(0, 3)}***` : 'unknown';
}

export function getImageKey(
  collection: string,
  folder = 'avatar',
  name: string,
) {
  return `${collection}/${folder}/${Date.now()}-${name}`;
}
