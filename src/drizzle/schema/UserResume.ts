import { pgTable } from 'drizzle-orm/pg-core';
import { uuid } from 'drizzle-orm/pg-core';
import { UserTable } from './User';
import { varchar } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from '@/utils/helpers';
import { relations } from 'drizzle-orm';

export const UserResumeTable = pgTable('user_resumes', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => UserTable.id),
  resumeFileUrl: varchar('resume_file_url').notNull(),
  resumeFileKey: varchar('resume_file_key').notNull(),
  aiSummary: varchar('ai_summary'),
  createdAt,
  updatedAt,
});

export const userResumeRelations = relations(UserResumeTable, ({ one }) => ({
  user: one(UserTable, {
    fields: [UserResumeTable.userId],
    references: [UserTable.id],
  }),
}));
