import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error";
import { authRouter } from "./modules/auth/auth.routes";
import { requireAuth, requirePermission } from "./middleware/auth";
import { clientsRouter } from "./modules/clients/clients.routes";
import { plansRouter } from "./modules/plans/plans.routes";
import { notificationsRouter } from "./modules/notifications";
import { adminRouter } from "./modules/admin/admin.routes";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use((req, _res, next) => { req.id = (req.headers["x-request-id"] as string) ?? crypto.randomUUID(); next(); });
  app.use(pinoHttp({ logger, genReqId: (req) => (req as any).id }));
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  app.get("/api/v1/health", (_req, res) => res.json({ status: "ok", db: mongoose.connection.readyState === 1 }));
  app.use("/api/v1/auth", authRouter);

  app.use("/api/v1/clients", clientsRouter);
  app.use("/api/v1/plans", plansRouter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/notifications", notificationsRouter);
  // RBAC smoke routes (replaced by real modules in Phase 2)
  app.get("/api/v1/admin/ping", requireAuth, requirePermission("config:write"), (_req, res) => res.json({ ok: true }));

  app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } }));
  app.use(errorHandler);
  return app;
}
