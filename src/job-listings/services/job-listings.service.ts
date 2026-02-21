import { DrizzleHealthService } from '@/drizzle/services/drizzle-health.service';
import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateJobListingApplicationDto, CreateJobListingDto, UpdateJobListingDto } from '../dto/job-listings.dto';
import { JobListingApplicationTable, JobListingTable, OrganizationTable, UserResumeTable } from '@/drizzle/schema';
import { and, desc, eq, like, or, count, SQL, inArray } from 'drizzle-orm';
import type { User } from '@/types';
import { AppPermissionService } from '@/permissions/services/app-permissions.service';
import * as Sentry from '@sentry/nestjs';
import { DatabaseUtilsService } from '@/common/services/database-utils.service';
import { InngestHealthService } from '@/inngest/services/inngest-health.service';
import { S3HealthService } from '@/s3/services/s3-health.service';

@Injectable()
export class JobListingsService {
  private readonly logger = new Logger(JobListingsService.name);

  constructor(
    private dbService: DrizzleHealthService,
    private appPermission: AppPermissionService,
    private dbUtilsService: DatabaseUtilsService,
    private appPermissionService: AppPermissionService,
    private inngestService: InngestHealthService,
    private s3Service: S3HealthService
  ) { }

  create = async (data: CreateJobListingDto, user: User, orgId: string) => {
    if (!this.appPermissionService.hasPermission(user, orgId, 'CREATE_JOB_LISTING')) {
      throw new ForbiddenException('You are not authorized to create job listings for this organization');
    }

    const { ...jobData } = data;

    // Verify org exists
    const org = await this.dbUtilsService.checkIfOrgExists(orgId);

    if (!org) {
      throw new NotFoundException('The organization does not exist');
    }

    // Verify user is owner of the organization
    const isOwner = await this.dbUtilsService.checkIfUserIsOrgOwner(user.id, orgId);

    if (!isOwner) {
      throw new ForbiddenException(
        'You are not authorized to create job listings for this organization'
      );
    }

    // Create job listing
    const [jobListing] = await this.dbService.getDb()
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
      `Job listing created with ID: ${jobListing.id} for organization: ${orgId} by user: ${user.id}`,
    );

    return jobListing
  };


  // Get all job listings with optional filtering
  findAll = async (
    search?: string,
    title?: string,
    organizationId?: string,
    status?: string, type?: string,
    locationRequirement?: string,
    experience?: string,
    city?: string,
    state?: string,
    jobIds?: string | string[]) => {
    // Build conditions array
    const conditions: SQL[] = [];

    if (search) {
      const searchCondition = or(
        like(JobListingTable.title, `%${search}%`),
        like(JobListingTable.description, `%${search}%`),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    if (title) {
      const titleCondition = like(JobListingTable.title, `%${title}%`);
      if (titleCondition) conditions.push(titleCondition);
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
    if (experience) {
      conditions.push(
        eq(JobListingTable.experienceLevel, experience as any),
      );
    }

    if (city) {
      conditions.push(eq(JobListingTable.city, city));
    }

    if (state) {
      conditions.push(eq(JobListingTable.stateAbbreviation, state));
    }

    if (jobIds && jobIds.length > 0) {
      const jobIdsArray = Array.isArray(jobIds) ? jobIds : [jobIds];
      conditions.push(inArray(JobListingTable.id, jobIdsArray));
    }

    // Build the query with all fields and joins
    let query = this.dbService.getDb().select({
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
  findOne = async (jobId: string, userId: string, orgId: string) => {
    const query = this.dbService.getDb().select({
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
      .where(eq(JobListingTable.id, jobId))
      .groupBy(JobListingTable.id, OrganizationTable.id)
      .limit(1);

    const [jobListing] = await query;

    if (!jobListing) {
      throw new NotFoundException("Job listing not found");
    }

    return jobListing;
  };


  // Update a job listing based on id
  update = async (user: User, orgId: string, jobId: string, dto: UpdateJobListingDto) => {
    const canUpdate = this.appPermission.hasPermission(user, orgId, 'UPDATE_JOB_LISTING');

    if (!canUpdate) {
      throw new ForbiddenException('You are not authorized to update this job listing');
    }

    const jobListing = await this.dbUtilsService.getJobListingById(jobId);

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
      await this.dbService.getDb()
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

    const jobListing = await this.dbUtilsService.getJobListingById(jobId);

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
      await this.dbService.getDb()
        .delete(JobListingTable)
        .where(eq(JobListingTable.id, jobId));
    } catch (error) {
      throw new InternalServerErrorException('Failed to delete job listing');
    }

    return true
  }

  // Get job listing applications
  getOwnJobListingApplication = async (userId: string, jobId: string) => {
    const jobListing = await this.dbUtilsService.getJobListingById(jobId);

    if (!jobListing) {
      return [];
    }

    const applications = await this.dbService.getDb()
      .select()
      .from(JobListingApplicationTable).where(and(eq(JobListingApplicationTable.jobListingId, jobId), eq(JobListingApplicationTable.userId, userId)))

    return applications
  }

  // Create job listing application
  createJobListingApplication = async (userId: string, jobId: string, dto: CreateJobListingApplicationDto) => {
    const [jobListing, userResume, existingApplication] = await Promise.all([
      this.dbUtilsService.getJobListingById(jobId),
      this.dbUtilsService.getResumeByUserId(userId),
      this.dbUtilsService.existingApplication(jobId, userId)
    ])

    if (!jobListing) {
      throw new NotFoundException('Job listing not found');
    }

    if (existingApplication) {
      throw new ConflictException('You have already applied for this job');
    }

    if (!userResume) {
      throw new NotFoundException('User resume not found. Please upload your resume before applying');
    }

    const application = await this.dbService.getDb()
      .insert(JobListingApplicationTable)
      .values({
        jobListingId: jobId,
        userId: userId,
        coverLetter: dto.coverLetter,
      })
      .returning()

    await this.inngestService.getInngest().send({
      name: "jobxhub/job_listing_application.created",
      data: { jobId, userId }
    })

    return application
  }

  // Upload resume
  uploadResume = async (userId: string, file: Express.Multer.File) => {
    const existingResume = await this.dbUtilsService.getResumeByUserId(userId);

    if (existingResume) {
      throw new ConflictException('You have already uploaded a resume. Please delete it before uploading a new one');
    }

    const { key: resumeKey, url: resumeUrl } = await this.s3Service.s3().uploadFileAndGetUrl(file, 'pdf', 'resumes');

    try {
      const resume = await this.dbService.getDb()
        .insert(UserResumeTable)
        .values({
          userId: userId,
          resumeFileUrl: resumeUrl,
          resumeFileKey: resumeKey,
        })
        .returning();

      // Send AFTER the DB insert so the resume row exists when the Inngest function queries it
      this.inngestService.getInngest().send({
        name: "jobxhub/resume.uploaded",
        data: { userId }
      });

      return resume;
    } catch (error) {
      await this.s3Service.s3().deleteFile(resumeKey);
      throw error;
    }
  };

  // Get user resume
  getUserResume = async (userId: string) => {
    const existingResume = await this.dbUtilsService.getResumeByUserId(userId)

    if (!existingResume) {
      throw new NotFoundException('You have not uploaded any resume yet.')
    }

    return existingResume
  }

  // Delete user resume
  deleteUserResume = async (userId: string) => {
    const existingResume = await this.dbUtilsService.getResumeByUserId(userId)

    if (!existingResume) {
      throw new NotFoundException('You have not uploaded any resume yet.')
    }

    await this.s3Service.s3().deleteFile(existingResume.resumeFileKey);

    await this.dbService.getDb()
      .delete(UserResumeTable)
      .where(eq(UserResumeTable.userId, userId));

    return true
  }
}
