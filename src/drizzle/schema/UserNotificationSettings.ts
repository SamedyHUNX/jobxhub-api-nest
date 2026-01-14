import { uuid } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';
import { UserTable } from './User';
import { boolean } from 'drizzle-orm/pg-core';
import { varchar } from 'drizzle-orm/pg-core';
import { createdAtCol, updatedAtCol } from '@/utils/helpers';
import { relations } from 'drizzle-orm';

export const UserNotificationSettingsTable = pgTable(
  'user_notification_settings',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => UserTable.id, { onDelete: 'cascade' }),
    newJobEmailNotifications: boolean('new_job_email_notifications')
      .notNull()
      .default(false),
    aiPrompt: varchar('ai_prompt'),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
);

export const userNotificationSettingsRelations = relations(
  UserNotificationSettingsTable,
  ({ one }) => ({
    user: one(UserTable, {
      fields: [UserNotificationSettingsTable.userId],
      references: [UserTable.id],
    }),
  }),
);
