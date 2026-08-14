import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { QUEUE_NAMES, PaymentVerifyJobData } from "../queues/queues";
import { verifyAndSettlePayment } from "../services/paymentService";

export function createPaymentVerifyWorker() {
  const worker = new Worker<PaymentVerifyJobData>(
    QUEUE_NAMES.PAYMENT_VERIFY,
    async (job: Job<PaymentVerifyJobData>) => {
      const payment = await verifyAndSettlePayment(job.data.paymentId);
      if (payment?.status === "PENDING") {
        throw new Error("Payment still pending, will retry");
      }
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    logger.warn({ paymentId: job?.data?.paymentId, err: err.message }, "Payment verification attempt failed");
  });

  return worker;
}
