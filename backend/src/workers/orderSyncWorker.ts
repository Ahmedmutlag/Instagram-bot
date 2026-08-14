import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { QUEUE_NAMES, OrderSyncJobData, orderSyncQueue } from "../queues/queues";
import { syncOrderStatus } from "../services/orderService";
import { prisma } from "../lib/prisma";

const SCAN_JOB_NAME = "scan-processing-orders";
const SCAN_INTERVAL_MS = 60_000;
const SCAN_BATCH_SIZE = 100;

export function createOrderSyncWorker() {
  return new Worker<OrderSyncJobData | Record<string, never>>(
    QUEUE_NAMES.ORDER_SYNC,
    async (job: Job) => {
      if (job.name === SCAN_JOB_NAME) {
        const orders = await prisma.order.findMany({
          where: { status: { in: ["PENDING", "PROCESSING"] }, providerOrderId: { not: null } },
          select: { id: true },
          take: SCAN_BATCH_SIZE,
          orderBy: { updatedAt: "asc" },
        });
        for (const order of orders) {
          try {
            await syncOrderStatus(order.id);
          } catch (error) {
            logger.warn({ orderId: order.id, error }, "Order status sync failed, will retry next scan");
          }
        }
        return;
      }

      const { orderId } = job.data as OrderSyncJobData;
      await syncOrderStatus(orderId);
    },
    { connection: redisConnection, concurrency: 2 }
  );
}

/** Schedules the recurring scan that keeps every in-flight order's status up to date. */
export async function scheduleOrderSyncScan() {
  await orderSyncQueue.add(
    SCAN_JOB_NAME,
    {},
    { repeat: { every: SCAN_INTERVAL_MS }, jobId: SCAN_JOB_NAME }
  );
}
