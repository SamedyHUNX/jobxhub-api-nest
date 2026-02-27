import {
  pgTable,
  varchar,
  timestamp,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { createdAtCol, idCol, updatedAtCol } from '@/utils/date.utils';
import { relations } from 'drizzle-orm';
import { UserNotificationSettingsTable } from './UserNotificationSettings';
import { UserResumeTable } from './UserResume';
import { OrganizationUserSettingsTable } from './OrganizationUserSettings';
import { UserSubscriptionsTable } from './UserSubscriptions';

export const UserTable = pgTable('users', {
  id: idCol(),
  username: varchar('username').notNull().unique(),
  imageUrl: varchar('image_url').notNull(),
  password: varchar().notNull(),
  email: varchar().notNull().unique(),
  firstName: varchar('first_name').notNull(),
  lastName: varchar('last_name').notNull(),
  dateOfBirth: timestamp('date_of_birth').notNull(),
  resetPasswordToken: varchar('reset_password_token'),
  resetPasswordExpires: timestamp('reset_password_expires', {
    withTimezone: true,
  }),
  phoneNumber: varchar('phone_number').notNull(),
  tokenVersion: integer('token_version').notNull().default(0),
  isBanned: boolean('is_banned').default(false),
  isVerified: boolean('is_verified').default(false),
  isDisabled: boolean('is_disabled').default(false),
  verificationToken: varchar('verification_token'),
  userRole: varchar('user_role').notNull().default('USER'),
  verificationExpires: timestamp('verification_expires', {
    withTimezone: true,
  }),
  createdAt: createdAtCol(),
  updatedAt: updatedAtCol(),
});

export const userRelations = relations(UserTable, ({ one, many }) => ({
  notificationSettings: one(UserNotificationSettingsTable),
  resume: one(UserResumeTable),
  organizationUserSettings: many(OrganizationUserSettingsTable),
  subscriptions: many(UserSubscriptionsTable),
}));
