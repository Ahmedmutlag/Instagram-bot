import { CouponType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { toNumber } from "../utils/money";

type TxClient = Prisma.TransactionClient | PrismaClient;

export interface CreateCouponInput {
  code: string;
  type: CouponType;
  value: number;
  maxUses?: number;
  minOrderAmount?: number;
  expiresAt?: string;
  isActive?: boolean;
}

export type UpdateCouponInput = Partial<CreateCouponInput>;

export async function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createCoupon(input: CreateCouponInput) {
  if (input.value <= 0) throw AppError.badRequest("قيمة الكوبون يجب أن تكون أكبر من صفر");
  if (input.type === "PERCENTAGE" && input.value > 100) {
    throw AppError.badRequest("نسبة الخصم لا يمكن أن تتجاوز 100%");
  }
  const existing = await prisma.coupon.findUnique({ where: { code: input.code } });
  if (existing) throw AppError.conflict("رمز الكوبون مستخدم بالفعل");

  return prisma.coupon.create({
    data: {
      code: input.code.toUpperCase(),
      type: input.type,
      value: input.value,
      maxUses: input.maxUses,
      minOrderAmount: input.minOrderAmount,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateCoupon(id: string, input: UpdateCouponInput) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("الكوبون غير موجود");
  return prisma.coupon.update({
    where: { id },
    data: {
      code: input.code ? input.code.toUpperCase() : undefined,
      type: input.type,
      value: input.value,
      maxUses: input.maxUses,
      minOrderAmount: input.minOrderAmount,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      isActive: input.isActive,
    },
  });
}

export async function deleteCoupon(id: string) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("الكوبون غير موجود");
  await prisma.coupon.delete({ where: { id } });
}

/** Validates a coupon code against an order amount and returns the discount amount (does not mutate anything). */
export async function validateCoupon(code: string, orderAmount: number, tx: TxClient = prisma) {
  const coupon = await tx.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.isActive) throw AppError.badRequest("كود الخصم غير صالح");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw AppError.badRequest("انتهت صلاحية كود الخصم");
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw AppError.badRequest("تم الوصول للحد الأقصى لاستخدام هذا الكوبون");
  }
  const minOrderAmount = toNumber(coupon.minOrderAmount as any);
  if (minOrderAmount > 0 && orderAmount < minOrderAmount) {
    throw AppError.badRequest(`الحد الأدنى لاستخدام هذا الكوبون هو ${minOrderAmount}`);
  }

  const discount =
    coupon.type === "PERCENTAGE" ? (orderAmount * toNumber(coupon.value as any)) / 100 : toNumber(coupon.value as any);

  return { coupon, discountAmount: Math.min(discount, orderAmount) };
}

/** Marks a coupon as used and records the usage. Must run inside the order's transaction. */
export async function applyCouponUsage(
  couponId: string,
  userId: string,
  orderId: string,
  discountAmount: number,
  tx: TxClient
) {
  await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
  await tx.couponUsage.create({
    data: { couponId, userId, orderId, discountAmount },
  });
}
