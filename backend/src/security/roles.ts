export const ROLES = ["client", "advisor", "reviewer", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

/** Granular permissions; roles map to sets. Extended as modules land. */
export const PERMISSIONS = {
  "client:read:own": ["client"],
  "client:read:assigned": ["advisor", "reviewer", "admin", "super_admin"],
  "client:read:all": ["admin", "super_admin"],
  "client:write": ["advisor", "admin", "super_admin"],
  "plan:approve": ["reviewer", "admin", "super_admin"],
  "config:write": ["admin", "super_admin"],
  "user:manage": ["admin", "super_admin"],
  "audit:read": ["reviewer", "admin", "super_admin"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;
export const can = (role: Role, p: Permission) => (PERMISSIONS[p] as readonly Role[]).includes(role);
