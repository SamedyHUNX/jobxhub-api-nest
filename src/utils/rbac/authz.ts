import { RolePermissions } from './roles';

export function hasPermission(role: string, permission: string): boolean {
    const allowed = RolePermissions[role] || [];
    return allowed.includes(permission);
}
