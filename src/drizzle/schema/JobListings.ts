import { createdAt, id, updatedAt } from '@/utils/helpers';
import { uuid } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';
import { OrganizationTable } from './Organization';
import { varchar } from 'drizzle-orm/pg-core';
import { text } from 'drizzle-orm/pg-core';
import { integer } from 'drizzle-orm/pg-core';
import { boolean } from 'drizzle-orm/pg-core';
import { timestamp } from 'drizzle-orm/pg-core';
import {
  experienceLevelEnum,
  jobListingStatusEnum,
  jobListingTypeEnum,
  locationRequirementEnum,
  wageIntervalEnum,
} from '@/utils/enums';
import { index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { JobListingApplicationTable } from './JobListingApplication';

export const JobListingTable = pgTable(
  'job-listings',
  {
    id,
    organizationId: uuid('organization_id')
      .references(() => OrganizationTable.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    title: varchar().notNull(),
    description: text().notNull(),
    wage: integer(),
    wageInterval: wageIntervalEnum('wage_interval'),
    stateAbbreviation: varchar('state_abbreviation'),
    city: varchar(),
    isFeatured: boolean('is_featured').notNull().default(false),
    locationRequirement: locationRequirementEnum(
      'location_requirement',
    ).notNull(),
    experienceLevel: experienceLevelEnum('experience_level').notNull(),
    status: jobListingStatusEnum().notNull().default('draft'),
    type: jobListingTypeEnum().notNull(),
    postedAt: timestamp({ withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [index().on(table.stateAbbreviation)],
);

export const jobListingReferences = relations(
  JobListingTable,
  ({ one, many }) => ({
    organization: one(OrganizationTable, {
      fields: [JobListingTable.organizationId],
      references: [OrganizationTable.id],
    }),
    applications: many(JobListingApplicationTable),
  }),
);
