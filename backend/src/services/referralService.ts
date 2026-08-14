import { Prisma, PrismaClient } from "@prisma/client";
import { creditBalance } from "./balanceService";
import { getNumericSetting, SETTINGS_KEYS } from "./settingsService";
import { prisma } from "../lib/prisma";

type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * Credits the referring user a commission on an order placed by someone they
 * referred. Runs inside the same transaction as order creation so the
 * commission and the order are atomic. No-op if the buyer has no referrer.
 */
export async function creditReferralEarningForOrder(params: {
  orderId: string;
  buyerUserId: string;
  orderPrice: number;
  tx: TxClient;
}) {
  const { orderId, buyerUserId, orderPrice, tx } = params;

  const buyer = await tx.user.findUnique({ where: { id: buyerUserId } });
  if (!buyer?.referredById) return null;

  const referralPercent = await getNumericSetting(SETTINGS_KEYS.REFERRAL_PERCENT);
  if (referralPercent <= 0) return null;

  const amount = Number(((orderPrice * referralPercent) / 100).toFixed(4));
  if (amount <= 0) return null;

  const { transaction } = await creditBalance(
    {
      userId: buyer.referredById,
      amount,
      type: "REFERRAL_BONUS",
      referenceId: orderId,
      description: `عمولة إحالة عن طلب برقم ${orderId}`,
    },
    tx
  );

  const earning = await tx.referralEarning.create({
    data: {
      referrerId: buyer.referredById,
      referredUserId: buyerUserId,
      orderId,
      amount,
      status: "CREDITED",
    },
  });

  return { earning, transaction };
}

export async function getReferralStats(userId: string) {
  const [referralsCount, earnings] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.referralEarning.aggregate({ where: { referrerId: userId }, _sum: { amount: true } }),
  ]);
  return {
    referralsCount,
    totalEarnings: earnings._sum.amount ? Number(earnings._sum.amount.toString()) : 0,
  };
}
