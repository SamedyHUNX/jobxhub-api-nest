import { OrgRolePermissions, AppRolePermissions } from './roles';

export function hasAppPermission(role: string, permission: string): boolean {
    const allowed = AppRolePermissions[role] || [];
    return allowed.includes(permission);
}

export function hasOrgPermission(role: string, permission: string): boolean {
    const allowed = OrgRolePermissions[role] || [];
    return allowed.includes(permission);
}
