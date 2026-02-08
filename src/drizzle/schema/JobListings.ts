import { createdAtCol, idCol, updatedAtCol } from '@/utils/helpers';
import { numeric, uuid, pgTable, varchar, boolean, timestamp, text } from 'drizzle-orm/pg-core';
import { OrganizationTable } from './Organizations';
import {
  experienceLevelEnum,
  jobListingStatusEnum,
  jobListingTypeEnum,
  locationRequirementEnum,
  wageIntervalEnum,
} from '@/types/enum';
import { index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { JobListingApplicationTable } from './JobListingApplication';

export const JobListingTable = pgTable(
  'job_listings',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .references(() => OrganizationTable.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    title: varchar().notNull(),
    description: text().notNull(),
    wage: numeric(),
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
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
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
