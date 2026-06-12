import { permissions, type Permission } from "@/server/permissions/permissions";

export const roles = ["super-admin", "owner", "admin", "manager", "agent", "viewer"] as const;

export type Role = (typeof roles)[number];

const allPermissions: Permission[] = Object.values(permissions);

export const rolePermissions: Record<Role, readonly Permission[]> = {
  "super-admin": allPermissions,
  owner: allPermissions,
  admin: allPermissions,
  manager: [
    permissions.contactsRead,
    permissions.contactsWrite,
    permissions.companiesRead,
    permissions.companiesWrite,
    permissions.inboxRead,
    permissions.inboxReply,
    permissions.inboxAssign,
    permissions.inboxManage,
    permissions.teamsRead,
    permissions.teamsWrite,
    permissions.aiRead,
    permissions.knowledgeRead,
    permissions.knowledgeManage,
    permissions.reportsRead,
    permissions.settingsRead
  ],
  agent: [
    permissions.contactsRead,
    permissions.companiesRead,
    permissions.inboxRead,
    permissions.inboxReply,
    permissions.knowledgeRead,
    permissions.knowledgeManage,
    permissions.aiRead,
    permissions.settingsRead
  ],
  viewer: [
    permissions.contactsRead,
    permissions.companiesRead,
    permissions.inboxRead,
    permissions.teamsRead,
    permissions.aiRead,
    permissions.knowledgeRead,
    permissions.automationsRead,
    permissions.reportsRead,
    permissions.billingRead,
    permissions.settingsRead
  ]
};

export function isRole(value: string | null | undefined): value is Role {
  return roles.includes(value as Role);
}

export function roleHasPermission(role: string | null | undefined, permission: Permission) {
  if (!isRole(role)) return false;
  return rolePermissions[role].includes(permission);
}
