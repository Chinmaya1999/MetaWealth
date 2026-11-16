import type { Request } from "express";
import { AuditLog } from "../database/models/AuditLog";
export const audit = (req: Request, action: string, entity: string, entityId: string, before?: unknown, after?: unknown, reason?: string) =>
  AuditLog.create({ userId: req.auth?.userId, action, entity, entityId, before, after, reason, requestId: req.id, ip: req.ip });
