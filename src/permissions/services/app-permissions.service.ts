import { OrganizationUserSettingsTable, UserSubscriptionsTable } from '@/drizzle/schema';
import { DrizzleHealthService } from '@/drizzle/services/drizzle-health.service';
import { AppRolePermissions, PermissionSets } from '@/permissions/utils/role-maps';
import type { User } from '@/types';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { SubscriptionPermissionsService } from './subscription-permissions.service';
import { getSubscriptionPlans } from '@/stripe/types/subscription-plans';

@Injectable()
export class AppPermissionService {
    constructor(private readonly dbService: DrizzleHealthService, private readonly subscriptionService: SubscriptionPermissionsService) { }

    private hasAppPermission(role: string, permission: string): boolean {
        const allowed = AppRolePermissions[role] || [];
        return allowed.includes(permission);
    }

    private async getOrgUser(userId: string, orgId: string) {
        const [orgUser] = await this.dbService.getDb().select()
            .from(OrganizationUserSettingsTable)
            .where(
                and(
                    eq(OrganizationUserSettingsTable.userId, userId),
                    eq(OrganizationUserSettingsTable.organizationId, orgId)
                )
            );
        return orgUser;
    }

    private async getUserSubscription(userId: string) {
        const [userSubscription] = await this.dbService.getDb().select()
            .from(UserSubscriptionsTable)
            .where(
                and(
                    eq(UserSubscriptionsTable.userId, userId)
                )
            );
        return userSubscription;
    }

    /**
     * Get all permissions for a user in an org
     * This includes:
     * 1. Their base role permissions (OWNER/MEMBER)
     * 2. Additional permission sets granted by the subscription plan
     */
    private async getOrgPermissions(userId: string, orgId: string): Promise<string[]> {
        const orgUser = await this.getOrgUser(userId, orgId);
        if (!orgUser) return [];

        // Start with base role permissions
        const basePermissions = PermissionSets[orgUser.role] || [];

        // Only apply subscription benefits if user is OWNER of the org
        if (orgUser.role !== 'OWNER') {
            return basePermissions; // MEMBERs only get their base permissions
        }

        // Get subscription and add granted permission sets (only for OWNERs)
        const subscription = await this.getUserSubscription(userId);
        if (!subscription || !this.subscriptionService.isSubscriptionActive(subscription)) {
            return basePermissions;
        }

        const plans = getSubscriptionPlans();
        const grantedSets = plans[subscription.planName].grantedPermissionSets || [];

        const grantedPermissions = grantedSets.flatMap(
            setName => PermissionSets[setName] || []
        );

        return [...new Set([...basePermissions, ...grantedPermissions])];
    }

    async hasPermission(user: User, orgId: string | null, permission: string): Promise<boolean> {
        // Check app-level first
        if (this.hasAppPermission(user.userRole, permission)) return true;

        // Check org-level
        if (orgId) {
            const orgPermissions = await this.getOrgPermissions(user.id, orgId);
            return orgPermissions.includes(permission);
        }

        return false;
    }
}
