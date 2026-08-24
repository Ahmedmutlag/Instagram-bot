import { createApp } from "./app";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const app = createApp();

// Platforms like Render assign the port to listen on via the PORT env var
// and health-check it directly; fall back to our own API_PORT for local
// dev / docker-compose where nothing sets PORT.
const port = Number(process.env.PORT) || env.API_PORT;

app.listen(port, () => {
  logger.info(`Admin API listening on port ${port}`);
});
