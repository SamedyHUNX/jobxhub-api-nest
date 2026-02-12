import { Injectable } from "@nestjs/common";
import { OrganizationTable, OrganizationUserSettingsTable, UserTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DrizzleHealthService } from "@/drizzle/services/drizzle-health.service";
import { Logger } from "@nestjs/common";

@Injectable()
export class OrganizationsUtilsService {
    private readonly logger = new Logger(OrganizationsUtilsService.name);

    constructor(private dbService: DrizzleHealthService) { }

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

    findUserOrganizations = async (userId: string) => {
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

    findOrganizationById = async (orgId: string) => {
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
}