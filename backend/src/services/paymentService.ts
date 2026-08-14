import { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { toNumber } from "../utils/money";
import { creditBalance } from "./balanceService";
import { getSetting, SETTINGS_KEYS } from "./settingsService";
import { getPaymentGateway, DEFAULT_PAYMENT_METHOD } from "../payments/registry";
import { paymentVerifyQueue, notificationQueue } from "../queues/queues";

export async function createDepositPayment(userId: string, amount: number, method: string = DEFAULT_PAYMENT_METHOD) {
  const minDeposit = Number(await getSetting(SETTINGS_KEYS.MIN_DEPOSIT));
  if (amount < minDeposit) {
    throw AppError.badRequest(`الحد الأدنى للإيداع هو ${minDeposit}`);
  }

  const currency = await getSetting(SETTINGS_KEYS.CURRENCY);
  const gateway = getPaymentGateway(method);
  const result = await gateway.createPayment({ userId, amount, currency });

  const payment = await prisma.payment.create({
    data: {
      userId,
      amount,
      currency,
      method,
      status: "PENDING",
      providerRef: result.providerRef,
    },
  });

  await paymentVerifyQueue.add(
    "verify",
    { paymentId: payment.id },
    { delay: 3_000 }
  );

  return { payment, redirectUrl: result.redirectUrl };
}

export async function verifyAndSettlePayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PENDING") return payment;

  const gateway = getPaymentGateway(payment.method);
  const verification = await gateway.verifyPayment({ providerRef: payment.providerRef ?? "" });

  if (verification.status === "PENDING") {
    return payment; // will be retried by the worker
  }

  const newStatus: PaymentStatus = verification.success ? "SUCCESS" : "FAILED";

  const updated = await prisma.$transaction(async (tx) => {
    const fresh = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!fresh || fresh.status !== "PENDING") return fresh;

    const paymentRow = await tx.payment.update({ where: { id: paymentId }, data: { status: newStatus } });

    if (newStatus === "SUCCESS") {
      await creditBalance(
        {
          userId: paymentRow.userId,
          amount: toNumber(paymentRow.amount),
          type: "DEPOSIT",
          referenceId: paymentRow.id,
          description: "إيداع رصيد",
        },
        tx
      );
    }
    return paymentRow;
  });

  if (updated) {
    const user = await prisma.user.findUnique({ where: { id: updated.userId } });
    if (user) {
      const message =
        newStatus === "SUCCESS"
          ? `تم إضافة ${toNumber(updated.amount)} إلى رصيدك بنجاح.`
          : `عذراً، فشلت عملية الإيداع الخاصة بك.`;
      await notificationQueue.add("notify", { telegramId: user.telegramId.toString(), message });
    }
  }

  return updated;
}

export async function listPayments(params: { page: number; limit: number; status?: PaymentStatus }) {
  const { page, limit, status } = params;
  const where: Prisma.PaymentWhereInput = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { user: { select: { id: true, username: true, telegramId: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);
  return { items, total };
}
