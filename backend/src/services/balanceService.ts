import { BalanceTransactionType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

type TxClient = Prisma.TransactionClient | PrismaClient;

interface AdjustBalanceParams {
  userId: string;
  amount: number; // always positive; direction determined by `type`
  type: BalanceTransactionType;
  referenceId?: string;
  description?: string;
}

/**
 * Credits a user's balance and writes an immutable ledger entry.
 * Safe to call within an existing transaction by passing `tx`.
 */
export async function creditBalance(params: AdjustBalanceParams, tx: TxClient = prisma) {
  if (params.amount <= 0) throw AppError.badRequest("المبلغ يجب أن يكون أكبر من صفر");

  const user = await tx.user.findUnique({ where: { id: params.userId } });
  if (!user) throw AppError.notFound("المستخدم غير موجود");

  const balanceBefore = user.balance;
  const balanceAfter = new Prisma.Decimal(balanceBefore).plus(params.amount);

  const updatedUser = await tx.user.update({
    where: { id: params.userId },
    data: { balance: balanceAfter },
  });

  const transaction = await tx.balanceTransaction.create({
    data: {
      userId: params.userId,
      type: params.type,
      amount: new Prisma.Decimal(params.amount),
      balanceBefore,
      balanceAfter,
      referenceId: params.referenceId,
      description: params.description,
    },
  });

  return { user: updatedUser, transaction };
}

/**
 * Debits a user's balance, throwing AppError.insufficientBalance if the
 * balance would go negative. Safe to call within an existing transaction.
 */
export async function debitBalance(params: AdjustBalanceParams, tx: TxClient = prisma) {
  if (params.amount <= 0) throw AppError.badRequest("المبلغ يجب أن يكون أكبر من صفر");

  const user = await tx.user.findUnique({ where: { id: params.userId } });
  if (!user) throw AppError.notFound("المستخدم غير موجود");

  const balanceBefore = user.balance;
  if (new Prisma.Decimal(balanceBefore).lessThan(params.amount)) {
    throw AppError.insufficientBalance();
  }
  const balanceAfter = new Prisma.Decimal(balanceBefore).minus(params.amount);

  const updatedUser = await tx.user.update({
    where: { id: params.userId },
    data: { balance: balanceAfter },
  });

  const transaction = await tx.balanceTransaction.create({
    data: {
      userId: params.userId,
      type: params.type,
      amount: new Prisma.Decimal(-params.amount),
      balanceBefore,
      balanceAfter,
      referenceId: params.referenceId,
      description: params.description,
    },
  });

  return { user: updatedUser, transaction };
}

export async function getUserTransactions(userId: string, page: number, limit: number) {
  const [items, total] = await Promise.all([
    prisma.balanceTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.balanceTransaction.count({ where: { userId } }),
  ]);
  return { items, total };
}
