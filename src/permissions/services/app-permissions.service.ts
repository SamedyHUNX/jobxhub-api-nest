import { OrganizationUserSettingsTable } from '@/drizzle/schema';
import { DrizzleHealthService } from '@/drizzle/services/drizzle-health.service';
import { AppRolePermissions, OrgRolePermissions } from '@/permissions/utils/role-maps';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class AppPermissionService {
    constructor(private readonly dbHealth: DrizzleHealthService) { }

    private get db() {
        return this.dbHealth.getDb();
    }

    hasAppPermission(role: string, permission: string): boolean {
        const allowed = AppRolePermissions[role] || [];
        return allowed.includes(permission);
    }

    async hasOrgPermission(userId: string, orgId: string, permission: string): Promise<boolean> {
        const [orgUser] = await this.db.select()
            .from(OrganizationUserSettingsTable)
            .where(
                and(
                    eq(OrganizationUserSettingsTable.userId, userId),
                    eq(OrganizationUserSettingsTable.organizationId, orgId)))
        if (!orgUser) return false;

        const allowed = OrgRolePermissions[orgUser.role] || [];
        return allowed.includes(permission);
    }

    async hasPermission(user: { id: string; userRole: string }, orgId: string | null, permission: string): Promise<boolean> {
        if (this.hasAppPermission(user.userRole, permission)) return true;

        // If orgId is provided, check org role
        if (orgId) {
            return this.hasOrgPermission(user.id, orgId, permission);
        }

        return false;
    }
}