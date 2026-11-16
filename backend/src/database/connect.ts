import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export async function connectDb() {
  mongoose.set("sanitizeFilter", true); // NoSQL injection guard
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  logger.info({ db: mongoose.connection.name }, "MongoDB connected");
}
