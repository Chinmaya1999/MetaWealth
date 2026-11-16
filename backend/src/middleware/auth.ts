import type { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../security/tokens";
import { can, type Permission, type Role } from "../security/roles";
import { HttpError } from "../utils/errors";
import { User } from "../database/models/User";

// A signed token is not enough: the account must still exist and be active, and the role is the one stored now
// (so disabling a user or changing a role takes effect within seconds, not when the token expires).
const live = new Map<string, { at: number; role: Role | null }>();
const TTL = 10_000;
export const forgetUser = (id: string) => live.delete(id);
async function currentRole(id: string): Promise<Role | null> {
  const hit = live.get(id); if (hit && Date.now() - hit.at < TTL) return hit.role;
  const u = await User.findOne({ _id: id, isActive: true, deletedAt: null }).select("role");
  const role = (u?.role as Role) ?? null; live.set(id, { at: Date.now(), role }); return role;
}

declare global {
  namespace Express {
    interface Request { auth?: { userId: string; role: Role }; id?: string }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return next(new HttpError(401, "Authentication required", "UNAUTHENTICATED"));
  let p; try { p = verifyAccess(h.slice(7)); } catch { return next(new HttpError(401, "Invalid or expired token", "UNAUTHENTICATED")); }
  try {
    const role = await currentRole(p.sub);
    if (!role) return next(new HttpError(401, "Account is disabled or no longer exists", "UNAUTHENTICATED"));
    req.auth = { userId: p.sub, role };
    next();
  } catch (e) { next(e); }
}

export const requirePermission = (perm: Permission) => (req: Request, _res: Response, next: NextFunction) =>
  req.auth && can(req.auth.role, perm) ? next() : next(new HttpError(403, "Forbidden", "FORBIDDEN"));
