import { DrizzleHealthService } from '@/drizzle/services/drizzle-health.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateJobListingDto } from './dtos/job-listings.dto';
import { JobListingTable, OrganizationTable } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class JobListingsService {
  private readonly logger = new Logger(JobListingsService.name);

  constructor(private dbHealth: DrizzleHealthService) {}

  private get db() {
    return this.dbHealth.getDb();
  }

  create = async (data: CreateJobListingDto, userId: string) => {
    const { organizationId, ...jobData } = data;

    // Verify org exists
    const [org] = await this.db
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.id, organizationId));

    if (!org) {
      throw new NotFoundException('The organization does not exist');
    }

    // Create job listing
    const [jobListing] = await this.db
      .insert(JobListingTable)
      .values({
        ...jobData,
        organizationId,
        status: data.status || 'draft',
        isFeatured: data.isFeatured || false,
        postedAt: data.postedAt ? new Date(data.postedAt) : null,
      })
      .returning();

    this.logger.log(
      `Job listing created with ID: ${jobListing.id} for organization: ${organizationId}`,
    );

    return {
      message: 'Job created successfuly',
      data: {
        jobListings: [jobListing],
      },
    };
  };
}
