import { Worker, Job } from "bullmq";
import { Telegraf } from "telegraf";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { QUEUE_NAMES, NotificationJobData } from "../queues/queues";

export function createNotificationWorker() {
  const telegram = new Telegraf(env.TELEGRAM_BOT_TOKEN).telegram;

  return new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job<NotificationJobData>) => {
      try {
        await telegram.sendMessage(job.data.telegramId, job.data.message);
      } catch (error) {
        logger.warn({ telegramId: job.data.telegramId, error }, "Failed to deliver notification (user may have blocked the bot)");
      }
    },
    { connection: redisConnection, concurrency: 10 }
  );
}
