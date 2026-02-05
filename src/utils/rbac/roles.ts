import { Permissions } from './permissions';

export const AppRolePermissions: Record<string, string[]> = {
    SUPER_ADMIN: [
        Permissions.FETCH_ALL_USERS,
        Permissions.DELETE_USER,
        // Add other global permissions
    ],
    USER: [
        // Typically minimal or none at app level
    ],
};

export const OrgRolePermissions: Record<string, string[]> = {
    OWNER: [
        Permissions.UPDATE_ORG,
        Permissions.DELETE_ORG,
        Permissions.CREATE_JOB_LISTING,
        Permissions.UPDATE_JOB_LISTING,
        Permissions.DELETE_JOB_LISTING,
        // Add org‑level management permissions
    ],
    MEMBER: [
        // Usually read‑only or limited org permissions
    ],
};

