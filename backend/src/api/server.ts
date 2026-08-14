import { createApp } from "./app";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const app = createApp();

app.listen(env.API_PORT, () => {
  logger.info(`Admin API listening on port ${env.API_PORT}`);
});
