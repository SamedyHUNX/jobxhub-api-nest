import { DrizzleHealthService } from '@/drizzle/services/drizzle-health.service';
import { ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateJobListingDto, UpdateJobListingDto } from '../dto/job-listings.dto';
import { JobListingApplicationTable, JobListingTable, OrganizationTable } from '@/drizzle/schema';
import { and, desc, eq, like, or, count, SQL } from 'drizzle-orm';
import type { User } from '@/types';
import { AppPermissionService } from '@/permissions/services/app-permissions.service';
import { ConfigService } from '@/common/services/config.service';
import * as Sentry from '@sentry/nestjs';
import { JobListingsUtilsService } from './job-listings-utils.service';

@Injectable()
export class JobListingsService {
  private readonly logger = new Logger(JobListingsService.name);

  constructor(private dbHealth: DrizzleHealthService, private appPermission: AppPermissionService, private readonly config: ConfigService, private readonly jobListingsUtilsService: JobListingsUtilsService) { }

  private get db() {
    return this.dbHealth.getDb();
  }

  create = async (data: CreateJobListingDto, userId: string, orgId: string) => {
    const { ...jobData } = data;

    // Verify org exists
    const org = await this.jobListingsUtilsService.checkIfOrgExists(orgId);

    if (!org) {
      throw new NotFoundException('The organization does not exist');
    }

    // Verify user is owner of the organization
    const membership = await this.jobListingsUtilsService.checkIfUserIsOwner(userId, orgId);

    if (!membership) {
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
    // Build conditions array
    const conditions: SQL[] = [];

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

    // Build the query with all fields and joins
    let query = this.db.select({
      id: JobListingTable.id,
      title: JobListingTable.title,
      description: JobListingTable.description,
      wage: JobListingTable.wage,
      wageInterval: JobListingTable.wageInterval,
      stateAbbreviation: JobListingTable.stateAbbreviation,
      city: JobListingTable.city,
      isFeatured: JobListingTable.isFeatured,
      locationRequirement: JobListingTable.locationRequirement,
      experienceLevel: JobListingTable.experienceLevel,
      type: JobListingTable.type,
      status: JobListingTable.status,
      postedAt: JobListingTable.postedAt,
      createdAt: JobListingTable.createdAt,
      updatedAt: JobListingTable.updatedAt,
      organizationId: JobListingTable.organizationId,
      applicationCount: count(JobListingApplicationTable.userId),
      organization: OrganizationTable
    })
      .from(JobListingTable)
      .leftJoin(
        OrganizationTable,
        eq(JobListingTable.organizationId, OrganizationTable.id),
      )
      .leftJoin(
        JobListingApplicationTable,
        eq(JobListingTable.id, JobListingApplicationTable.jobListingId)
      )
      .groupBy(JobListingTable.id, OrganizationTable.id)
      .orderBy(desc(JobListingTable.createdAt));

    // Apply where conditions if any exist
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const data = await query;

    return data;
  }

  // Find job listings based on id
  findOne = async (id: string, userId: string, orgId: string) => {
    const jobListing = await this.jobListingsUtilsService.getJobListing(id);

    if (!jobListing) {
      throw new NotFoundException('Job listing not found');
    }

    return jobListing
  }

  // Update a job listing based on id
  update = async (user: User, orgId: string, jobId: string, dto: UpdateJobListingDto) => {
    const canUpdate = this.appPermission.hasPermission(user, orgId, 'UPDATE_JOB_LISTING');

    if (!canUpdate) {
      throw new ForbiddenException('You are not authorized to update this job listing');
    }

    const jobListing = await this.jobListingsUtilsService.getJobListing(jobId);

    if (!jobListing) {
      throw new NotFoundException('Job listing not found');
    }

    if (jobListing.organizationId !== orgId) {
      Sentry.captureException(
        new Error(`Unauthorized update attempt: jobId=${jobId}, orgId=${orgId}, userId=${user.id}`)
      );
      throw new ForbiddenException('You cannot update this job listing');
    }

    // Handle publishing logic
    let postedAt = dto.postedAt ? new Date(dto.postedAt) : undefined;

    // If status is changing from draft to published, set postedAt to now
    if (dto.status === 'published' && jobListing.status === 'draft' && !postedAt) {
      postedAt = new Date();
    }

    // If status is changing from published to draft, clear postedAt
    if (dto.status === 'draft' && jobListing.status === 'published') {
      postedAt = undefined;
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
          postedAt: postedAt,
        })
        .where(eq(JobListingTable.id, jobId));
    } catch (error) {
      throw new InternalServerErrorException('Failed to update job listing');
    }

    return true
  }

  // Delete a job listing based on id
  delete = async (user: User, orgId: string, jobId: string) => {
    const canDelete = this.appPermission.hasPermission(user, orgId, 'DELETE_JOB_LISTING');

    if (!canDelete) {
      throw new ForbiddenException('You are not authorized to delete this job listing');
    }

    const jobListing = await this.jobListingsUtilsService.getJobListing(jobId);

    if (!jobListing) {
      throw new NotFoundException('Job listing not found');
    }

    if (jobListing.organizationId !== orgId) {
      Sentry.captureException(
        new Error(`Unauthorized delete attempt: jobId=${jobId}, orgId=${orgId}, userId=${user.id}`)
      );
      throw new ForbiddenException('You cannot delete this job listing');
    }

    try {
      await this.db
        .delete(JobListingTable)
        .where(eq(JobListingTable.id, jobId));
    } catch (error) {
      throw new InternalServerErrorException('Failed to delete job listing');
    }

    return true
  }
}
