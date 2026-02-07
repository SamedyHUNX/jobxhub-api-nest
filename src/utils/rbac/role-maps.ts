import { Permissions } from './permissions';

export const AppRolePermissions: Record<string, string[]> = {
    SUPER_ADMIN: [
        Permissions.READ_ALL_USERS,
        Permissions.CREATE_USER,
        Permissions.UPDATE_USER,
        Permissions.DELETE_USER,
        Permissions.READ_USER,
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
        Permissions.CHANGE_JOB_LISTING_STATUS,
        Permissions.READ_BILLING,
        Permissions.UPDATE_APPLICANT,
        Permissions.CHANGE_APPLICANT_STAGE,
        Permissions.CHANGE_APPLICANT_RATING,
        Permissions.APPROVE_APPLICANT,
        Permissions.READ_JOB_LISTING,
        Permissions.READ_APPLICANT,
        // Add org‑level management permissions
    ],

    MEMBER: [
        // Usually read‑only or limited org permissions
        Permissions.READ_JOB_LISTING,
        Permissions.READ_APPLICANT,
    ],

    APPLICANT_MANAGER: [
        Permissions.READ_JOB_LISTING,
        Permissions.READ_APPLICANT,
        Permissions.APPROVE_APPLICANT,
        Permissions.DENY_APPLICANT,
        Permissions.UPDATE_APPLICANT,
        Permissions.CHANGE_APPLICANT_RATING,
        Permissions.CHANGE_APPLICANT_STAGE,
    ],

    JOB_LISTING_MANAGER: [
        Permissions.CREATE_JOB_LISTING,
        Permissions.UPDATE_JOB_LISTING,
        Permissions.DELETE_JOB_LISTING,
        Permissions.READ_JOB_LISTING,
        Permissions.CHANGE_JOB_LISTING_STATUS,
        Permissions.READ_BILLING,
    ],

    ORG_ADMIN: [
        Permissions.CREATE_ORG,
        Permissions.UPDATE_ORG,
        Permissions.DELETE_ORG,
        Permissions.READ_ORG,
        // Add other admin‑level permissions as needed
    ],
};


