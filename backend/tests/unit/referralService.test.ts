import { createOrder } from "../../src/services/orderService";
import { getReferralStats } from "../../src/services/referralService";
import { createTestUser, createTestService } from "../factories";
import { updateSettings } from "../../src/services/settingsService";
import { prisma } from "../../src/lib/prisma";
import { findOrCreateUser } from "../../src/services/userService";

jest.mock("../../src/services/providerService", () => ({
  getAdapterForProvider: jest.fn(),
}));
import { getAdapterForProvider } from "../../src/services/providerService";
const mockedGetAdapter = getAdapterForProvider as jest.MockedFunction<typeof getAdapterForProvider>;

describe("referralService", () => {
  it("credits the referrer a commission when the referred user places a paid order", async () => {
    await updateSettings({ referralPercent: "10" });

    const referrer = await createTestUser({ balance: 0 });
    const referred = await findOrCreateUser({ telegramId: BigInt(5555), username: "referred-buyer" }, referrer.referralCode);
    await prisma.user.update({ where: { id: referred.id }, data: { balance: 100 } });

    const { service, provider } = await createTestService({ price: 10, min: 100, max: 5000 });
    mockedGetAdapter.mockResolvedValue({
      provider,
      adapter: { createOrder: jest.fn().mockResolvedValue({ providerOrderId: "p1" }), getOrderStatus: jest.fn(), getBalance: jest.fn(), getServices: jest.fn() },
    } as any);

    await createOrder({ userId: referred.id, serviceId: service.id, link: "https://instagram.com/x", quantity: 1000 });

    const freshReferrer = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });
    // 10% of the 10$ order = 1$
    expect(Number(freshReferrer.balance)).toBeCloseTo(1);

    const stats = await getReferralStats(referrer.id);
    expect(stats.referralsCount).toBe(1);
    expect(stats.totalEarnings).toBeCloseTo(1);
  });

  it("does not credit anyone when the buyer has no referrer", async () => {
    await updateSettings({ referralPercent: "10" });
    const user = await createTestUser({ balance: 100 });
    const { service, provider } = await createTestService({ price: 10, min: 100, max: 5000 });
    mockedGetAdapter.mockResolvedValue({
      provider,
      adapter: { createOrder: jest.fn().mockResolvedValue({ providerOrderId: "p1" }), getOrderStatus: jest.fn(), getBalance: jest.fn(), getServices: jest.fn() },
    } as any);

    await createOrder({ userId: user.id, serviceId: service.id, link: "https://instagram.com/x", quantity: 1000 });

    const earningsCount = await prisma.referralEarning.count();
    expect(earningsCount).toBe(0);
  });
});
