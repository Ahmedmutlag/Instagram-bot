// Combined entry point that runs the Telegram bot AND the background
// workers in a single Node process. Functionally identical to running
// `bot/index.ts` and `workers/index.ts` as two separate processes — this
// exists purely so cost-constrained deployments (e.g. a single low-tier
// hosting plan) can run both for the price of one service instead of two.
// Prefer the separate entry points when running under docker-compose /
// anywhere the extra process has no real cost, since it keeps the bot's
// crash/restart cycle independent from the workers'.
import { createBot } from "./bot";
import { logger } from "./lib/logger";
import "./workers/index";

const bot = createBot();

bot
  .launch()
  .then(() => logger.info("Telegram bot started (long polling) [combined process]"));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
