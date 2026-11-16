import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/errors";
import { logger } from "../utils/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid request", details: err.flatten(), requestId: req.id } });
  if (err instanceof HttpError) return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details, requestId: req.id } });
  logger.error({ err, requestId: req.id }, "Unhandled error");
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong", requestId: req.id } });
}
