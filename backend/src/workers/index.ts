import { logger } from "../lib/logger";
import { createOrderSubmitWorker } from "./orderSubmitWorker";
import { createOrderSyncWorker, scheduleOrderSyncScan } from "./orderSyncWorker";
import { createPaymentVerifyWorker } from "./paymentVerifyWorker";
import { createNotificationWorker } from "./notificationWorker";

async function main() {
  const workers = [
    createOrderSubmitWorker(),
    createOrderSyncWorker(),
    createPaymentVerifyWorker(),
    createNotificationWorker(),
  ];

  await scheduleOrderSyncScan();

  logger.info("Background workers started: order-submit, order-sync, payment-verify, notification");

  const shutdown = async () => {
    logger.info("Shutting down workers...");
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error({ err }, "Failed to start workers");
  process.exit(1);
});
