import { toNumber } from "../utils/money";

export function serializeUser(user: any) {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    languageCode: user.languageCode,
    balance: toNumber(user.balance),
    isBanned: user.isBanned,
    referralCode: user.referralCode,
    referredById: user.referredById,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...(user._count ? { ordersCount: user._count.orders, referralsCount: user._count.referrals } : {}),
  };
}

export function serializeOrder(order: any) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    user: order.user
      ? {
          id: order.user.id,
          username: order.user.username,
          telegramId: order.user.telegramId?.toString?.() ?? order.user.telegramId,
        }
      : undefined,
    serviceId: order.serviceId,
    service: order.service ? { id: order.service.id, name: order.service.name } : undefined,
    providerId: order.providerId,
    provider: order.provider ? { id: order.provider.id, name: order.provider.name } : undefined,
    providerOrderId: order.providerOrderId,
    link: order.link,
    quantity: order.quantity,
    price: toNumber(order.price),
    cost: toNumber(order.cost),
    profit: toNumber(order.profit),
    status: order.status,
    startCount: order.startCount,
    remains: order.remains,
    errorMessage: order.errorMessage,
    couponCode: order.couponCode,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function serializePayment(payment: any) {
  return {
    id: payment.id,
    userId: payment.userId,
    user: payment.user
      ? { id: payment.user.id, username: payment.user.username, telegramId: payment.user.telegramId?.toString?.() }
      : undefined,
    amount: toNumber(payment.amount),
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    providerRef: payment.providerRef,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

export function serializeCoupon(coupon: any) {
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: toNumber(coupon.value),
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    minOrderAmount: coupon.minOrderAmount ? toNumber(coupon.minOrderAmount) : null,
    expiresAt: coupon.expiresAt,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
  };
}
