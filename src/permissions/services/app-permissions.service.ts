import { AppRolePermissionSets, PermissionSets } from '@/permissions/utils/role-maps';
import type { User } from '@/types';
import { Injectable } from '@nestjs/common';
import { SubscriptionPermissionsService } from './subscription-permissions.service';
import { getSubscriptionPlans } from '@/stripe/types/subscription-plans';
import { DatabaseUtilsService } from '@/common/services/database-utils.service';

@Injectable()
export class AppPermissionService {
    constructor(private readonly subscriptionService: SubscriptionPermissionsService, private dbUtilsService: DatabaseUtilsService) { }

    private hasAppPermission(role: string, permission: string): boolean {
        const allowed = AppRolePermissionSets[role] || [];
        return allowed.includes(permission);
    }

    /**
     * Get all permissions for a user in an org
     * This includes:
     * 1. Their base role permissions (OWNER/MEMBER)
     * 2. Additional permission sets granted by the subscription plan
     */
    private async getOrgPermissions(userId: string, orgId: string): Promise<string[]> {
        const orgUser = await this.dbUtilsService.getOrgsForUserId(userId);
        const org = orgUser.find((org) => org.organizationId === orgId);
        if (!org) return [];

        // Start with base role permissions
        const basePermissions = PermissionSets[org.role] || [];

        // Only apply subscription benefits if user is OWNER of the org
        if (org.role !== 'OWNER') {
            return basePermissions; // MEMBERs only get their base permissions
        }

        // Get subscription and add granted permission sets (only for OWNERs)
        const subscription = await this.dbUtilsService.getUserSubscription(userId);
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
