import { DrizzleHealthService } from '@/drizzle/services/drizzle-health.service';
import { ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateJobListingDto, UpdateJobListingDto } from './dtos/job-listings.dto';
import { JobListingTable, OrganizationTable, OrganizationUserSettingsTable } from '@/drizzle/schema';
import { and, eq, like, or } from 'drizzle-orm';
import type { User } from '@/types';
import { PermissionService } from '@/common/services/permission.service';
import { ConfigService } from '@/common/services/config.service';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class JobListingsService {
  private readonly logger = new Logger(JobListingsService.name);

  constructor(private dbHealth: DrizzleHealthService, private permission: PermissionService, private readonly config: ConfigService) { }

  private get db() {
    return this.dbHealth.getDb();
  }

  create = async (data: CreateJobListingDto, userId: string, orgId: string) => {
    const { ...jobData } = data;

    // Verify org exists
    const [org] = await this.db
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.id, orgId));

    if (!org) {
      throw new NotFoundException('The organization does not exist');
    }

    // Verify user is owner of the organization
    const [membership] = await this.db
      .select({
        role: OrganizationUserSettingsTable.role,
      })
      .from(OrganizationUserSettingsTable)
      .where(
        and(
          eq(OrganizationUserSettingsTable.organizationId, orgId),
          eq(OrganizationUserSettingsTable.userId, userId)
        )
      )
      .limit(1);

    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException(
        'You are not authorized to create job listings for this organization'
      );
    }

    // Create job listing
    const [jobListing] = await this.db
      .insert(JobListingTable)
      .values({
        ...jobData,
        organizationId: orgId,
        status: data.status || 'draft',
        isFeatured: data.isFeatured || false,
        postedAt: data.postedAt ? new Date(data.postedAt) : new Date(),
      })
      .returning();

    this.logger.log(
      `Job listing created with ID: ${jobListing.id} for organization: ${orgId} by user: ${userId}`,
    );

    return jobListing
  };


  // Get all job listings with optional filtering
  findAll = async (search?: string, organizationId?: string, status?: string, type?: string, locationRequirement?: string, experienceLevel?: string, userId?: string) => {
    const baseQuery = this.db
      .select()
      .from(JobListingTable)
      .leftJoin(
        OrganizationTable,
        eq(JobListingTable.organizationId, OrganizationTable.id),
      );

    const conditions: any[] = [];

    if (search) {
      const searchCondition = or(
        like(JobListingTable.title, `%${search}%`),
        like(JobListingTable.description, `%${search}%`),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    if (organizationId) {
      conditions.push(eq(JobListingTable.organizationId, organizationId));
    }
    if (status) {
      conditions.push(eq(JobListingTable.status, status as any));
    }
    if (type) {
      conditions.push(eq(JobListingTable.type, type as any));
    }
    if (locationRequirement) {
      conditions.push(
        eq(JobListingTable.locationRequirement, locationRequirement as any),
      );
    }
    if (experienceLevel) {
      conditions.push(
        eq(JobListingTable.experienceLevel, experienceLevel as any),
      );
    }

    const jobListings =
      conditions.length > 0
        ? await baseQuery.where(and(...conditions))
        : await baseQuery;

    // Flatten results
    const flattened = jobListings.map((row) => ({
      ...row.job_listings,
      organization: row.organizations
    }))

    return flattened
  }

  // Find job listings based on id
  findOne = async (id: string, userId: string, orgId: string) => {
    const [jobListing] = await this.db
      .select()
      .from(JobListingTable)
      .where(eq(JobListingTable.id, id))
      .limit(1);

    if (!jobListing) {
      throw new NotFoundException('Job listing not found');
    }

    return jobListing
  }

  // Update a job listing based on id
  update = async (user: User, orgId: string, jobId: string, dto: UpdateJobListingDto) => {
    const canUpdate = this.permission.hasPermission(user, orgId, 'UPDATE_JOB_LISTING');

    if (!canUpdate) {
      throw new ForbiddenException('You are not authorized to update this job listing');
    }

    const [jobListing] = await this.db
      .select()
      .from(JobListingTable)
      .where(eq(JobListingTable.id, jobId))

    if (!jobListing) {
      throw new NotFoundException('Job listing not found');
    }

    if (jobListing.organizationId !== orgId) {
      Sentry.captureException(
        new Error(`Unauthorized update attempt: jobId=${jobId}, orgId=${orgId}, userId=${user.id}`)
      );
      throw new ForbiddenException('You cannot update this job listing');
    }


    try {
      await this.db
        .update(JobListingTable)
        .set({
          title: dto.title,
          description: dto.description,
          wage: dto.wage,
          wageInterval: dto.wageInterval,
          stateAbbreviation: dto.stateAbbreviation,
          city: dto.city,
          isFeatured: dto.isFeatured,
          locationRequirement: dto.locationRequirement,
          experienceLevel: dto.experienceLevel,
          status: dto.status,
          type: dto.type,
          postedAt: dto.postedAt ? new Date(dto.postedAt) : undefined,
        })
        .where(eq(JobListingTable.id, jobId));
    } catch (error) {
      throw new InternalServerErrorException('Failed to update job listing');
    }

    return true
  }
}
