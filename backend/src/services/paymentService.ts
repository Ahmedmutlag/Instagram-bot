import { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { toNumber } from "../utils/money";
import { creditBalance } from "./balanceService";
import { getSetting, SETTINGS_KEYS } from "./settingsService";
import { getPaymentGateway, DEFAULT_PAYMENT_METHOD, MANUAL_PAYMENT_METHOD } from "../payments/registry";
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

  // Manual transfers are confirmed by an admin, not by polling a gateway.
  if (method !== MANUAL_PAYMENT_METHOD) {
    await paymentVerifyQueue.add("verify", { paymentId: payment.id }, { delay: 3_000 });
  } else {
    await notifyAdminOfManualDeposit(payment.id, userId, amount, currency);
  }

  return { payment, redirectUrl: result.redirectUrl };
}

async function notifyAdminOfManualDeposit(paymentId: string, userId: string, amount: number, currency: string) {
  const adminChatId = await getSetting(SETTINGS_KEYS.ADMIN_NOTIFY_CHAT_ID);
  if (!adminChatId.trim()) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const who = user ? `@${user.username ?? user.telegramId.toString()}` : userId;

  await notificationQueue.add("notify", {
    telegramId: adminChatId.trim(),
    message: `🔔 طلب إيداع جديد بانتظار المراجعة\n\nمن: ${who}\nالمبلغ: ${amount} ${currency}\nرقم العملية: ${paymentId}\n\nراجع لوحة الإدارة → المدفوعات لتأكيده أو رفضه.`,
  });
}

async function settlePaymentStatus(paymentId: string, newStatus: "SUCCESS" | "FAILED", metadata?: Record<string, unknown>) {
  const updated = await prisma.$transaction(async (tx) => {
    const fresh = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!fresh || fresh.status !== "PENDING") return fresh;

    const paymentRow = await tx.payment.update({
      where: { id: paymentId },
      data: { status: newStatus, metadata: metadata as any },
    });

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
          : `عذراً، لم يتم تأكيد عملية الإيداع الخاصة بك. تواصل مع الدعم إذا كنت قد أرسلت المبلغ فعلاً.`;
      await notificationQueue.add("notify", { telegramId: user.telegramId.toString(), message });
    }
  }

  return updated;
}

export async function verifyAndSettlePayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PENDING") return payment;

  const gateway = getPaymentGateway(payment.method);
  const verification = await gateway.verifyPayment({ providerRef: payment.providerRef ?? "" });

  if (verification.status === "PENDING") {
    return payment; // will be retried by the worker
  }

  return settlePaymentStatus(paymentId, verification.success ? "SUCCESS" : "FAILED");
}

/** Admin action: approve a pending manual (bank transfer) deposit once the funds are confirmed received. */
export async function confirmManualPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw AppError.notFound("عملية الدفع غير موجودة");
  if (payment.method !== MANUAL_PAYMENT_METHOD) {
    throw AppError.badRequest("هذا الإجراء متاح فقط لعمليات الإيداع اليدوية");
  }
  if (payment.status !== "PENDING") {
    throw AppError.badRequest("تم التعامل مع هذه العملية مسبقاً");
  }
  return settlePaymentStatus(paymentId, "SUCCESS");
}

/** Admin action: reject a pending manual deposit (e.g. no funds received / invalid reference). */
export async function rejectManualPayment(paymentId: string, reason?: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw AppError.notFound("عملية الدفع غير موجودة");
  if (payment.method !== MANUAL_PAYMENT_METHOD) {
    throw AppError.badRequest("هذا الإجراء متاح فقط لعمليات الإيداع اليدوية");
  }
  if (payment.status !== "PENDING") {
    throw AppError.badRequest("تم التعامل مع هذه العملية مسبقاً");
  }
  return settlePaymentStatus(paymentId, "FAILED", reason ? { rejectionReason: reason } : undefined);
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
