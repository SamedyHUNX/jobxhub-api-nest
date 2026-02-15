import { JobListingTable, OrganizationTable, OrganizationUserSettingsTable, UserSubscriptionsTable, UserTable } from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

@Injectable()
export class DatabaseUtilsService {
    private readonly logger = new Logger(DatabaseUtilsService.name);
    constructor(private dbService: DrizzleHealthService) { }

    // UserTable
    findUserByUserId = async (userId: string) => {
        if (!userId) {
            this.logger.error('Missing userId');
            throw new BadRequestException('No userId provided');
        }

        const [user] = await this.dbService.getDb()
            .select({ id: UserTable.id })
            .from(UserTable)
            .where(eq(UserTable.id, userId))
            .limit(1);

        if (!user) {
            this.logger.error(`User not found for userId: ${userId}`);
            throw new NotFoundException(`User not found for userId: ${userId}`);
        }

        return user;
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
}
