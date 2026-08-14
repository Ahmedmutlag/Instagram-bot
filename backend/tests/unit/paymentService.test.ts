import { createDepositPayment, verifyAndSettlePayment } from "../../src/services/paymentService";
import { updateSettings } from "../../src/services/settingsService";
import { createTestUser } from "../factories";
import { AppError } from "../../src/utils/errors";
import { prisma } from "../../src/lib/prisma";
import { paymentVerifyQueue } from "../../src/queues/queues";

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
});
