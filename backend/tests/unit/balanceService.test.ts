import { creditBalance, debitBalance, getUserTransactions } from "../../src/services/balanceService";
import { createTestUser } from "../factories";
import { AppError } from "../../src/utils/errors";
import { prisma } from "../../src/lib/prisma";

describe("balanceService", () => {
  it("credits a user's balance and writes a ledger entry", async () => {
    const user = await createTestUser({ balance: 10 });
    const { user: updated, transaction } = await creditBalance({
      userId: user.id,
      amount: 25,
      type: "DEPOSIT",
      description: "test deposit",
    });

    expect(Number(updated.balance)).toBe(35);
    expect(Number(transaction.amount)).toBe(25);
    expect(Number(transaction.balanceBefore)).toBe(10);
    expect(Number(transaction.balanceAfter)).toBe(35);
  });

  it("debits a user's balance when sufficient funds exist", async () => {
    const user = await createTestUser({ balance: 50 });
    const { user: updated } = await debitBalance({
      userId: user.id,
      amount: 20,
      type: "ORDER_PAYMENT",
    });
    expect(Number(updated.balance)).toBe(30);
  });

  it("throws AppError.insufficientBalance and does not mutate balance when funds are insufficient", async () => {
    const user = await createTestUser({ balance: 5 });

    await expect(
      debitBalance({ userId: user.id, amount: 10, type: "ORDER_PAYMENT" })
    ).rejects.toThrow(AppError);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(fresh.balance)).toBe(5);
    const transactions = await prisma.balanceTransaction.count({ where: { userId: user.id } });
    expect(transactions).toBe(0);
  });

  it("never deletes historical balance transactions and lists them newest first", async () => {
    const user = await createTestUser({ balance: 100 });
    await creditBalance({ userId: user.id, amount: 5, type: "DEPOSIT" });
    await debitBalance({ userId: user.id, amount: 3, type: "ORDER_PAYMENT" });

    const { items, total } = await getUserTransactions(user.id, 1, 10);
    expect(total).toBe(2);
    expect(items[0].type).toBe("ORDER_PAYMENT");
    expect(items[1].type).toBe("DEPOSIT");
  });

  it("rejects non-positive amounts", async () => {
    const user = await createTestUser({ balance: 100 });
    await expect(creditBalance({ userId: user.id, amount: 0, type: "DEPOSIT" })).rejects.toThrow(AppError);
    await expect(debitBalance({ userId: user.id, amount: -5, type: "ORDER_PAYMENT" })).rejects.toThrow(AppError);
  });
});
