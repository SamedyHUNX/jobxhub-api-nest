import { JobListingTable, OrganizationTable, OrganizationUserSettingsTable } from "@/drizzle/schema";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

@Injectable()
export class JobListingsUtilsService {
    constructor(private dbService: DrizzleHealthService) { }

    checkIfOrgExists = async (orgId: string) => {
        const [org] = await this.dbService.getDb()
            .select()
            .from(OrganizationTable)
            .where(eq(OrganizationTable.id, orgId))

        return org;
    }

    checkIfUserIsOwner = async (userId: string, orgId: string) => {
        const [membership] = await this.dbService.getDb()
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
                'You are not authorized to do this action'
            );
        }

        return membership;
    }

    getJobListing = async (jobId: string) => {
        const [jobListing] = await this.dbService.getDb()
            .select()
            .from(JobListingTable)
            .where(eq(JobListingTable.id, jobId))

        return jobListing;
    }
}