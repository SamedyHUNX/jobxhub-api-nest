import { pgTable, uuid } from 'drizzle-orm/pg-core';
import { JobListingTable } from './JobListings';
import { UserTable } from './User';
import { text } from 'drizzle-orm/pg-core';
import { integer } from 'drizzle-orm/pg-core';
import { applicationStageEnum } from '@/utils/enums';
import { createdAtCol, updatedAtCol } from '@/utils/helpers';
import { primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const JobListingApplicationTable = pgTable(
  'job_listing_applications',
  {
    jobListingId: uuid('job_listing_id')
      .references(() => JobListingTable.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    userId: uuid('user_id')
      .references(() => UserTable.id, { onDelete: 'cascade' })
      .notNull(),
    coverLetter: text('cover_letter'),
    rating: integer(),
    stage: applicationStageEnum().notNull().default('applied'),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (table) => [primaryKey({ columns: [table.jobListingId, table.userId] })],
);

export const jobListingApplicationRelations = relations(
  JobListingApplicationTable,
  ({ one }) => ({
    jobListing: one(JobListingTable, {
      fields: [JobListingApplicationTable.jobListingId],
      references: [JobListingTable.id],
    }),
    user: one(UserTable, {
      fields: [JobListingApplicationTable.userId],
      references: [UserTable.id],
    }),
  }),
);
