import { JobListingApplicationTable, JobListingTable, OrganizationTable, OrganizationUserSettingsTable, UserResumeTable, UserSubscriptionsTable, UserTable } from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq, or } from "drizzle-orm";

@Injectable()
export class DatabaseUtilsService {
    private readonly logger = new Logger(DatabaseUtilsService.name);
    constructor(private dbService: DrizzleHealthService) { }

    // UserTable
    findUserByUserIdOrEmail = async (userId: string | null | undefined, email: string | null | undefined) => {
        if (!userId && !email) {
            this.logger.error('Missing userId or email');
            throw new BadRequestException('No userId or email provided');
        }

        if (userId) {
            const [user] = await this.dbService.getDb()
                .select()
                .from(UserTable)
                .where(eq(UserTable.id, userId))
                .limit(1);

            if (!user) {
                this.logger.error(`User not found for userId: ${userId}`);
                throw new NotFoundException(`User not found for userId: ${userId}`);
            }

            return user;
        } else if (email) {
            const [user] = await this.dbService.getDb()
                .select()
                .from(UserTable)
                .where(eq(UserTable.email, email))
                .limit(1);

            if (!user) {
                this.logger.error(`User not found for email: ${email}`);
                throw new NotFoundException("Invalid credentials");
            }

            return user;
        } else {
            this.logger.error('Missing userId or email');
            throw new BadRequestException('No userId or email provided');
        }

    }

    validateUserDoesNotExist = async (email: string, username: string) => {
        const existingUser = await this.dbService.getDb()
            .select()
            .from(UserTable)
            .where(or(eq(UserTable.email, email), eq(UserTable.username, username)))
            .limit(1);

        if (existingUser.length > 0) {
            if (existingUser[0].email === email) {
                throw new ConflictException('Email already exists');
            }
            if (existingUser[0].username === username) {
                throw new ConflictException('Username already taken');
            }
        }
    }

    // OrganizationTable
    findUserOrgs = async (userId: string) => {
        const orgs = await this.dbService.getDb()
            .select()
            .from(OrganizationTable)
            .innerJoin(
                OrganizationUserSettingsTable,
                eq(OrganizationTable.id, OrganizationUserSettingsTable.organizationId),
            )
            .where(eq(OrganizationUserSettingsTable.userId, userId));

        return orgs;
    }


    findOrgByOrgId = async (orgId: string) => {
        const [org] = await this.dbService.getDb()
            .select()
            .from(OrganizationTable)
            .where(eq(OrganizationTable.id, orgId))
            .limit(1);

        if (!org) {
            this.logger.error(`Organization not found for orgId: ${orgId}`);
            throw new NotFoundException(`Organization not found for orgId: ${orgId}`);
        }

        return org;
    }

    checkIfOrgExists = async (orgId: string) => {
        const [org] = await this.dbService.getDb()
            .select()
            .from(OrganizationTable)
            .where(eq(OrganizationTable.id, orgId))

        return org;
    }

    checkIfUserIsOrgOwner = async (userId: string, orgId: string) => {
        const [isOwner] = await this.dbService.getDb()
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

        if (!isOwner || isOwner.role !== 'OWNER') {
            throw new ForbiddenException(
                'You are not authorized to do this action'
            );
        }

        return isOwner;
    }

    // JobListingTable
    getJobListingById = async (jobId: string) => {
        const [jobListing] = await this.dbService.getDb()
            .select()
            .from(JobListingTable)
            .where(eq(JobListingTable.id, jobId))

        return jobListing;
    }

    // OrganizationUserSettingsTable
    getOrgsForUserId = async (userId: string) => {
        const orgUser = await this.dbService.getDb().select()
            .from(OrganizationUserSettingsTable)
            .where(
                eq(OrganizationUserSettingsTable.userId, userId)
            );
        return orgUser;
    }

    // UserSubscriptionsTable
    getUserSubscription = async (userId: string) => {
        const [userSubscription] = await this.dbService.getDb().select()
            .from(UserSubscriptionsTable)
            .where(
                and(
                    eq(UserSubscriptionsTable.userId, userId)
                )
            );
        return userSubscription;
    }

    // ResumeTable
    getResumeByUserId = async (userId: string) => {
        const [resume] = await this.dbService.getDb()
            .select()
            .from(UserResumeTable)
            .where(eq(UserResumeTable.userId, userId))

        return resume;
    }

    // Existing application for a job
    existingApplication = async (jobListingId: string, userId: string) => {
        const [application] = await this.dbService.getDb()
            .select()
            .from(JobListingApplicationTable)
            .where(
                and(
                    eq(JobListingApplicationTable.jobListingId, jobListingId),
                    eq(JobListingApplicationTable.userId, userId)
                )
            )

        return application;
    }

    // Update Resume
    updateResume = async (userId: string, data: Partial<typeof UserResumeTable.$inferInsert>) => {
        const [resume] = await this.dbService.getDb()
            .update(UserResumeTable)
            .set(data)
            .where(eq(UserResumeTable.userId, userId))
            .returning();

        return resume;
    }

    // Get cover letter
    getCoverLetter = async (userId: string, jobId: string) => {
        const [result] = await this.dbService.getDb()
            .select({ coverLetter: JobListingApplicationTable.coverLetter })
            .from(JobListingApplicationTable)
            .where(
                and(
                    eq(JobListingApplicationTable.jobListingId, jobId),
                    eq(JobListingApplicationTable.userId, userId)
                )
            );

        return result?.coverLetter;
    };

    updateJobListingApplication = async (jobListingId: string, userId: string, data: Partial<typeof JobListingApplicationTable.$inferInsert>) => {
        const [application] = await this.dbService.getDb()
            .update(JobListingApplicationTable)
            .set(data)
            .where(
                and(
                    eq(JobListingApplicationTable.jobListingId, jobListingId),
                    eq(JobListingApplicationTable.userId, userId)
                )
            )
            .returning();

        return application;
    };
}
