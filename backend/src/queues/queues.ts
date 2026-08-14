import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";

export const QUEUE_NAMES = {
  ORDER_SUBMIT: "order-submit",
  ORDER_SYNC: "order-sync",
  PAYMENT_VERIFY: "payment-verify",
  NOTIFICATION: "notification",
} as const;

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 86_400 },
};

export const orderSubmitQueue = new Queue(QUEUE_NAMES.ORDER_SUBMIT, {
  connection: redisConnection,
  defaultJobOptions,
});

export const orderSyncQueue = new Queue(QUEUE_NAMES.ORDER_SYNC, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
});

export const paymentVerifyQueue = new Queue(QUEUE_NAMES.PAYMENT_VERIFY, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 10 },
});

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
  connection: redisConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2_000 }, removeOnComplete: true },
});

export interface OrderSubmitJobData {
  orderId: string;
}

export interface OrderSyncJobData {
  orderId: string;
}

export interface PaymentVerifyJobData {
  paymentId: string;
}

export interface NotificationJobData {
  telegramId: string;
  message: string;
}
