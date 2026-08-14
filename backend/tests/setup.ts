import { prisma } from "../src/lib/prisma";
import { redisConnection } from "../src/lib/redis";
import { orderSubmitQueue, orderSyncQueue, paymentVerifyQueue, notificationQueue } from "../src/queues/queues";

async function cleanDatabase() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.referralEarning.deleteMany(),
    prisma.couponUsage.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.balanceTransaction.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.order.deleteMany(),
    prisma.service.deleteMany(),
    prisma.providerService.deleteMany(),
    prisma.provider.deleteMany(),
    prisma.user.deleteMany(),
    prisma.admin.deleteMany(),
    prisma.setting.deleteMany(),
  ]);
}

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
  await Promise.all([
    orderSubmitQueue.close(),
    orderSyncQueue.close(),
    paymentVerifyQueue.close(),
    notificationQueue.close(),
  ]);
  redisConnection.disconnect();
});
