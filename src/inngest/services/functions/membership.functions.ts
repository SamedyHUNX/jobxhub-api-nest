import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InngestHealthService } from "../inngest-health.service";
import { DatabaseUtilsService } from "@/common/services/database-utils.service";

@Injectable()
export class MembershipFunctions implements OnModuleInit {
    private readonly logger = new Logger(MembershipFunctions.name);

    private createOrgMembership;
    private deleteOrgMembership;

    constructor(
        private readonly inngestService: InngestHealthService,
        private readonly dbUtilsService: DatabaseUtilsService,
    ) { }

    onModuleInit() {
        this.createOrgMembership = this.inngestService.getInngest().createFunction(
            { id: 'jobxhub/create-org-user-settings', name: 'JobXHub - Create Org User Settings' },
            { event: 'jobxhub/org-membership.created' },
            async ({ event, step }) => {
                const { orgId, userId } = event.data;
                await step.run('create-org-user-settings', async () => {
                    await this.dbUtilsService.createOrgUserSettings(userId, orgId);
                });
                return { success: true };
            },
        );

        this.deleteOrgMembership = this.inngestService.getInngest().createFunction(
            { id: 'jobxhub/delete-org-user-settings', name: 'JobXHub - Delete Org User Settings' },
            { event: 'jobxhub/org-membership.deleted' },
            async ({ event, step }) => {
                const { orgId, userId } = event.data;
                await step.run('delete-org-user-settings', async () => {
                    await this.dbUtilsService.deleteOrgUserSettings(userId, orgId);
                });
                return { success: true };
            },
        );
    }

    getFunctions() {
        return [this.createOrgMembership, this.deleteOrgMembership];
    }
}