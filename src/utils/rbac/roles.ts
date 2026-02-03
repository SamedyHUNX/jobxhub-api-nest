import { Permissions } from './permissions';

export const RolePermissions: Record<string, string[]> = {
    SUPER_ADMIN: [
        Permissions.FETCH_ALL_USERS,
        Permissions.DELETE_USER,
    ],
    ADMIN: [
        // Add later
    ],
    USER: [],
};
