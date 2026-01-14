import { pgTable } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from '@/utils/helpers';
import { varchar } from 'drizzle-orm/pg-core';
import { timestamp } from 'drizzle-orm/pg-core';
import { integer } from 'drizzle-orm/pg-core';
import { boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { UserNotificationSettingsTable } from './UserNotificationSettings';
import { UserResumeTable } from './UserResume';
import { OrganizationUserSettingsTable } from './OrganizationUserSettings';

export const UserTable = pgTable('users', {
  id,
  username: varchar('username').notNull(),
  imageUrl: varchar('image_url').notNull(),
  password: varchar().notNull(),
  email: varchar().notNull().unique(),
  firstName: varchar('first_name').notNull(),
  lastName: varchar('last_name').notNull(),
  fullName: varchar('full_name'),
  resetPasswordToken: varchar('reset_password_token'),
  resetPasswordExpires: timestamp('reset_password_expires'),
  tokenVersion: integer('token_version').notNull().default(0),
  isBanned: boolean('is_banned').default(false),
  isVerified: boolean('is_verified').default(false),
  isDisabled: boolean('is_disabled').default(false),
  verificationToken: varchar('verification_token'),
  userRole: varchar('user_role').notNull().default('USER'),
  verificationExpires: timestamp('verification_expires', {
    withTimezone: true,
  }),
  createdAt,
  updatedAt,
});

export const userRelations = relations(UserTable, ({ one, many }) => ({
  notificationSettings: one(UserNotificationSettingsTable),
  resume: one(UserResumeTable),
  organizationUserSettings: many(OrganizationUserSettingsTable),
}));
