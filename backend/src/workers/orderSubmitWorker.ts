import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { QUEUE_NAMES, OrderSubmitJobData } from "../queues/queues";
import { trySubmitOrderToProvider, markOrderFailedAndRefund } from "../services/orderService";

export function createOrderSubmitWorker() {
  const worker = new Worker<OrderSubmitJobData>(
    QUEUE_NAMES.ORDER_SUBMIT,
    async (job: Job<OrderSubmitJobData>) => {
      const success = await trySubmitOrderToProvider(job.data.orderId);
      if (!success) {
        throw new Error("Provider order submission failed, will retry with backoff");
      }
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= attempts) {
      logger.warn({ orderId: job.data.orderId }, "Order submission exhausted retries, refunding");
      await markOrderFailedAndRefund(job.data.orderId, err.message);
    }
  });

  return worker;
}
