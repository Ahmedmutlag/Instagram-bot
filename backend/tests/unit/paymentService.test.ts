import {
  createDepositPayment,
  verifyAndSettlePayment,
  confirmManualPayment,
  rejectManualPayment,
} from "../../src/services/paymentService";
import { updateSettings } from "../../src/services/settingsService";
import { createTestUser } from "../factories";
import { AppError } from "../../src/utils/errors";
import { prisma } from "../../src/lib/prisma";
import { paymentVerifyQueue } from "../../src/queues/queues";
import { MANUAL_PAYMENT_METHOD } from "../../src/payments/registry";

describe("paymentService", () => {
  beforeEach(async () => {
    await updateSettings({ minDeposit: "5" });
  });

  it("rejects a deposit below the configured minimum", async () => {
    const user = await createTestUser({ balance: 0 });
    await expect(createDepositPayment(user.id, 1)).rejects.toThrow(AppError);
  });

  it("creates a PENDING payment and enqueues verification", async () => {
    const user = await createTestUser({ balance: 0 });
    const enqueueSpy = jest.spyOn(paymentVerifyQueue, "add").mockResolvedValue({} as any);

    const { payment } = await createDepositPayment(user.id, 20);
    expect(payment.status).toBe("PENDING");
    expect(Number(payment.amount)).toBe(20);
    expect(enqueueSpy).toHaveBeenCalledWith("verify", { paymentId: payment.id }, { delay: 3000 });

    enqueueSpy.mockRestore();
  });

  it("credits the user's balance once the mock gateway confirms the payment", async () => {
    const user = await createTestUser({ balance: 0 });
    jest.spyOn(paymentVerifyQueue, "add").mockResolvedValue({} as any);

    const { payment } = await createDepositPayment(user.id, 30);
    const settled = await verifyAndSettlePayment(payment.id);

    expect(settled?.status).toBe("SUCCESS");
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(freshUser.balance)).toBe(30);

    const ledgerEntry = await prisma.balanceTransaction.findFirst({ where: { userId: user.id, type: "DEPOSIT" } });
    expect(ledgerEntry).not.toBeNull();
  });

  it("is idempotent — settling an already-settled payment does not double-credit", async () => {
    const user = await createTestUser({ balance: 0 });
    jest.spyOn(paymentVerifyQueue, "add").mockResolvedValue({} as any);

    const { payment } = await createDepositPayment(user.id, 15);
    await verifyAndSettlePayment(payment.id);
    await verifyAndSettlePayment(payment.id);

    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(freshUser.balance)).toBe(15);
  });

  it("does not enqueue automatic verification for manual (bank transfer) deposits", async () => {
    const user = await createTestUser({ balance: 0 });
    const enqueueSpy = jest.spyOn(paymentVerifyQueue, "add").mockResolvedValue({} as any);

    await createDepositPayment(user.id, 20, MANUAL_PAYMENT_METHOD);
    expect(enqueueSpy).not.toHaveBeenCalled();

    enqueueSpy.mockRestore();
  });

  it("credits the balance when an admin confirms a manual deposit", async () => {
    const user = await createTestUser({ balance: 0 });
    const { payment } = await createDepositPayment(user.id, 25, MANUAL_PAYMENT_METHOD);

    const confirmed = await confirmManualPayment(payment.id);
    expect(confirmed?.status).toBe("SUCCESS");

    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(freshUser.balance)).toBe(25);
  });

  it("does not credit the balance when an admin rejects a manual deposit", async () => {
    const user = await createTestUser({ balance: 0 });
    const { payment } = await createDepositPayment(user.id, 25, MANUAL_PAYMENT_METHOD);

    const rejected = await rejectManualPayment(payment.id, "لم يصل التحويل");
    expect(rejected?.status).toBe("FAILED");

    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(freshUser.balance)).toBe(0);
  });

  it("rejects confirming a non-manual payment through the manual-confirm action", async () => {
    const user = await createTestUser({ balance: 0 });
    jest.spyOn(paymentVerifyQueue, "add").mockResolvedValue({} as any);
    const { payment } = await createDepositPayment(user.id, 10);

    await expect(confirmManualPayment(payment.id)).rejects.toThrow(AppError);
  });

  it("rejects confirming a manual payment twice", async () => {
    const user = await createTestUser({ balance: 0 });
    const { payment } = await createDepositPayment(user.id, 10, MANUAL_PAYMENT_METHOD);

    await confirmManualPayment(payment.id);
    await expect(confirmManualPayment(payment.id)).rejects.toThrow(AppError);

    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(freshUser.balance)).toBe(10);
  });
});
