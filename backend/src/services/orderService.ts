import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { AppError } from "../utils/errors";
import { toNumber } from "../utils/money";
import { generateOrderNumber } from "../utils/orderNumber";
import { isValidTargetLink } from "../utils/validateLink";
import { debitBalance, creditBalance } from "./balanceService";
import { getAdapterForProvider } from "./providerService";
import { validateCoupon, applyCouponUsage } from "./couponService";
import { creditReferralEarningForOrder } from "./referralService";
import { orderSubmitQueue, notificationQueue } from "../queues/queues";

export interface CreateOrderInput {
  userId: string;
  serviceId: string;
  link: string;
  quantity: number;
  couponCode?: string;
}

/** Computes total price/cost for a quantity given per-1000 rates. */
function computeAmount(ratePer1000: number, quantity: number): number {
  return Number(((ratePer1000 / 1000) * quantity).toFixed(4));
}

export async function createOrder(input: CreateOrderInput) {
  if (!isValidTargetLink(input.link)) {
    throw AppError.badRequest("الرابط الذي أدخلته غير صالح");
  }

  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
    include: { provider: true, providerService: true },
  });
  if (!service || service.status !== "ACTIVE") throw AppError.notFound("الخدمة غير متوفرة حالياً");
  if (service.provider.status !== "ACTIVE") throw AppError.badRequest("مزود هذه الخدمة غير متاح حالياً");

  if (input.quantity < service.minQuantity || input.quantity > service.maxQuantity) {
    throw AppError.badRequest(
      `الكمية يجب أن تكون بين ${service.minQuantity} و ${service.maxQuantity}`
    );
  }

  const grossPrice = computeAmount(toNumber(service.price), input.quantity);
  const cost = computeAmount(toNumber(service.providerService.costPrice), input.quantity);

  const result = await prisma.$transaction(async (tx) => {
    let finalPrice = grossPrice;
    let couponId: string | undefined;
    let discountAmount = 0;

    if (input.couponCode) {
      const { coupon, discountAmount: discount } = await validateCoupon(input.couponCode, grossPrice, tx);
      couponId = coupon.id;
      discountAmount = discount;
      finalPrice = Number((grossPrice - discount).toFixed(4));
    }

    await debitBalance(
      {
        userId: input.userId,
        amount: finalPrice,
        type: "ORDER_PAYMENT",
        description: `دفع مقابل طلب: ${service.name}`,
      },
      tx
    );

    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: input.userId,
        serviceId: service.id,
        providerId: service.providerId,
        link: input.link.trim(),
        quantity: input.quantity,
        price: finalPrice,
        cost,
        profit: Number((finalPrice - cost).toFixed(4)),
        status: "PENDING",
        couponCode: input.couponCode?.toUpperCase(),
      },
    });

    if (couponId) {
      await applyCouponUsage(couponId, input.userId, order.id, discountAmount, tx);
    }

    await creditReferralEarningForOrder({
      orderId: order.id,
      buyerUserId: input.userId,
      orderPrice: finalPrice,
      tx,
    });

    return order;
  });

  // Attempt immediate submission to the provider for fast feedback; if this
  // fails (network hiccup, provider temporarily down) the background worker
  // retries with exponential backoff instead of failing the order outright.
  const submitted = await trySubmitOrderToProvider(result.id);
  if (!submitted) {
    await orderSubmitQueue.add("submit", { orderId: result.id });
  }

  return prisma.order.findUniqueOrThrow({ where: { id: result.id } });
}

/**
 * Attempts to send a PENDING order to its provider once. Returns true if it
 * succeeded (order moved to PROCESSING), false if it should be retried by
 * the background worker.
 */
export async function trySubmitOrderToProvider(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { service: { include: { providerService: true } } } });
  if (!order || order.status !== "PENDING") return true;

  try {
    const { adapter } = await getAdapterForProvider(order.providerId);
    const result = await adapter.createOrder({
      externalServiceId: order.service.providerService.externalServiceId,
      link: order.link,
      quantity: order.quantity,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { providerOrderId: result.providerOrderId, status: "PROCESSING", errorMessage: null },
    });
    await notifyUser(order.userId, `تم إرسال طلبك رقم ${order.orderNumber} إلى المزود وهو الآن قيد التنفيذ.`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    logger.warn({ orderId, error: message }, "Failed to submit order to provider");
    await prisma.order.update({ where: { id: order.id }, data: { errorMessage: message } });
    return false;
  }
}

/** Called by the retry worker after all attempts are exhausted. */
export async function markOrderFailedAndRefund(orderId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "PENDING") return;

    await tx.order.update({ where: { id: orderId }, data: { status: "FAILED", errorMessage: reason } });
    await creditBalance(
      {
        userId: order.userId,
        amount: toNumber(order.price),
        type: "REFUND",
        referenceId: order.id,
        description: `استرجاع بسبب فشل تنفيذ الطلب رقم ${order.orderNumber}`,
      },
      tx
    );
  });
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order) {
    await notifyUser(order.userId, `عذراً، فشل تنفيذ طلبك رقم ${order.orderNumber} وتم استرجاع المبلغ إلى رصيدك.`);
  }
}

export async function syncOrderStatus(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.providerOrderId) return order;
  if (["COMPLETED", "CANCELED", "FAILED"].includes(order.status)) return order;

  const { adapter } = await getAdapterForProvider(order.providerId);
  const statusResult = await adapter.getOrderStatus(order.providerOrderId);

  if (statusResult.status === order.status && statusResult.remains === order.remains) {
    return order;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: statusResult.status as OrderStatus,
      startCount: statusResult.startCount ?? order.startCount,
      remains: statusResult.remains ?? order.remains,
    },
  });

  if (statusResult.status !== order.status) {
    await notifyUser(order.userId, orderStatusMessage(updated.orderNumber, statusResult.status));
  }

  return updated;
}

function orderStatusMessage(orderNumber: string, status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    PENDING: "قيد الانتظار",
    PROCESSING: "قيد التنفيذ",
    COMPLETED: "مكتمل",
    PARTIAL: "منفذ جزئياً",
    CANCELED: "ملغي",
    FAILED: "فشل",
  };
  return `تحديث الطلب رقم ${orderNumber}: الحالة الآن "${labels[status]}"`;
}

export async function refundOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.notFound("الطلب غير موجود");
  if (order.status === "COMPLETED") {
    throw AppError.badRequest("لا يمكن استرجاع طلب مكتمل");
  }
  if (order.status === "CANCELED") {
    throw AppError.badRequest("تم استرجاع هذا الطلب مسبقاً");
  }

  return prisma.$transaction(async (tx) => {
    await creditBalance(
      {
        userId: order.userId,
        amount: toNumber(order.price),
        type: "REFUND",
        referenceId: order.id,
        description: `استرجاع يدوي للطلب رقم ${order.orderNumber}`,
      },
      tx
    );
    return tx.order.update({ where: { id: orderId }, data: { status: "CANCELED" } });
  });
}

export async function listOrders(params: {
  page: number;
  limit: number;
  status?: OrderStatus;
  userId?: string;
  query?: string;
}) {
  const { page, limit, status, userId, query } = params;
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(userId ? { userId } : {}),
    ...(query ? { OR: [{ orderNumber: { contains: query, mode: "insensitive" } }, { link: { contains: query, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: { select: { id: true, username: true, telegramId: true } }, service: true, provider: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total };
}

export async function getOrderById(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: true, service: true, provider: { select: { id: true, name: true } } },
  });
  if (!order) throw AppError.notFound("الطلب غير موجود");
  return order;
}

export async function listOrdersForUser(userId: string, page: number, limit: number) {
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      include: { service: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where: { userId } }),
  ]);
  return { items, total };
}

async function notifyUser(userId: string, message: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await notificationQueue.add("notify", { telegramId: user.telegramId.toString(), message });
}
