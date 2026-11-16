import { createApp } from "./app";
import { connectDb } from "./database/connect";
import { env } from "./config/env";
import { startScheduler } from "./modules/notifications";
import { logger } from "./utils/logger";

await connectDb();
createApp().listen(env.PORT, () => { logger.info(`API listening on :${env.PORT}`); if (env.NODE_ENV !== "test") startScheduler(); });
