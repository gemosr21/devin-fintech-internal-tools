import type { DB } from "./db";
import { HttpError } from "./errors";

// DEMO IDENTITY ONLY. The cookie is set by an unauthenticated switcher and can be forged by anyone.
// It exists to exercise server-side authorization, not to authenticate users.
export const DEMO_IDENTITY_COOKIE = "demo_user";

export type Role = "viewer" | "reviewer" | "admin";
export type Actor = { id: string; name: string; role: Role };

const PERMISSIONS = {
  "refunds:read": ["viewer", "reviewer", "admin"],
  "refunds:decide": ["reviewer"],
  "flags:read": ["viewer", "reviewer", "admin"],
  "flags:write": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function resolveActor(db: DB, userId: string | null | undefined): Actor | null {
  if (!userId) return null;
  return (db.prepare("SELECT id, name, role FROM users WHERE id = ?").get(userId) as Actor | undefined) ?? null;
}

export function can(actor: Actor | null, permission: Permission): boolean {
  return !!actor && (PERMISSIONS[permission] as readonly Role[]).includes(actor.role);
}

export function requirePermission(actor: Actor | null, permission: Permission): Actor {
  if (!actor) throw new HttpError(401, "No recognized demo identity");
  if (!can(actor, permission)) throw new HttpError(403, `Role '${actor.role}' lacks permission '${permission}'`);
  return actor;
}

export function listUsers(db: DB): Actor[] {
  return db.prepare("SELECT id, name, role FROM users ORDER BY role, name").all() as Actor[];
}
