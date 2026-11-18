import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TTL: z.string().default("15m"),
  REFRESH_TTL_DAYS: z.coerce.number().default(7),
  DATA_ENCRYPTION_KEY: z.string().optional(),
  SEED_DEMO_PASSWORD: z.string().optional(),
  // Set COOKIE_SECURE=false when serving over plain HTTP (no TLS yet); defaults to true in production.
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
});
export const env = schema.parse(process.env);
