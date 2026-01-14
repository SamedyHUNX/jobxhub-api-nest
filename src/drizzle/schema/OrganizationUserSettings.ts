import { uuid } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';
import { UserTable } from './User';
import { OrganizationTable } from './Organization';
import { varchar } from 'drizzle-orm/pg-core';
import { boolean } from 'drizzle-orm/pg-core';
import { integer } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from '@/utils/helpers';
import { primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const OrganizationUserSettingsTable = pgTable(
  'organization_user_settings',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => UserTable.id),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => OrganizationTable.id),
    role: varchar('role').notNull().default('Member'),
    newApplicationEmailNotifications: boolean(
      'new_application_email_notifications',
    )
      .notNull()
      .default(false),
    minimumRating: integer('minimum_rating'),
    createdAt,
    updatedAt,
  },
  (table) => [primaryKey({ columns: [table.userId, table.organizationId] })],
);

export const organizationUserSettingsRelations = relations(
  OrganizationUserSettingsTable,
  ({ one }) => ({
    user: one(UserTable, {
      fields: [OrganizationUserSettingsTable.userId],
      references: [UserTable.id],
    }),
    organization: one(OrganizationTable, {
      fields: [OrganizationUserSettingsTable.organizationId],
      references: [OrganizationTable.id],
    }),
  }),
);
