import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env";
import type { Role } from "./roles";

export interface AccessPayload { sub: string; role: Role }
export const signAccess = (p: AccessPayload) => jwt.sign(p, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TTL as any });
export const verifyAccess = (t: string) => jwt.verify(t, env.JWT_ACCESS_SECRET) as AccessPayload & { exp: number };

export function newRefresh(userId: string) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, { expiresIn: `${env.REFRESH_TTL_DAYS}d` as any });
  return { token, jti, hash: hashToken(token), expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 86400_000) };
}
export const verifyRefresh = (t: string) => jwt.verify(t, env.JWT_REFRESH_SECRET) as { sub: string; jti: string };
export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
