import { createCoupon, validateCoupon } from "../../src/services/couponService";
import { createOrder } from "../../src/services/orderService";
import { createTestUser, createTestService } from "../factories";
import { AppError } from "../../src/utils/errors";
import { prisma } from "../../src/lib/prisma";

jest.mock("../../src/services/providerService", () => ({
  getAdapterForProvider: jest.fn(),
}));
import { getAdapterForProvider } from "../../src/services/providerService";
const mockedGetAdapter = getAdapterForProvider as jest.MockedFunction<typeof getAdapterForProvider>;

describe("couponService", () => {
  it("computes a percentage discount", async () => {
    const coupon = await createCoupon({ code: "SAVE10", type: "PERCENTAGE", value: 10 });
    const { discountAmount } = await validateCoupon(coupon.code, 100);
    expect(discountAmount).toBe(10);
  });

  it("computes a fixed discount, capped at the order amount", async () => {
    const coupon = await createCoupon({ code: "FIXED50", type: "FIXED", value: 50 });
    const { discountAmount } = await validateCoupon(coupon.code, 20);
    expect(discountAmount).toBe(20); // capped, never exceeds the order total
  });

  it("rejects an expired coupon", async () => {
    const coupon = await createCoupon({
      code: "OLD",
      type: "FIXED",
      value: 5,
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    await expect(validateCoupon(coupon.code, 100)).rejects.toThrow(AppError);
  });

  it("rejects a coupon once its max uses are reached", async () => {
    const coupon = await createCoupon({ code: "LIMITED", type: "FIXED", value: 5, maxUses: 1 });
    await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: 1 } });
    await expect(validateCoupon(coupon.code, 100)).rejects.toThrow(AppError);
  });

  it("rejects orders below the coupon's minimum order amount", async () => {
    const coupon = await createCoupon({ code: "MIN20", type: "FIXED", value: 5, minOrderAmount: 20 });
    await expect(validateCoupon(coupon.code, 10)).rejects.toThrow(AppError);
  });

  it("applies a coupon discount end-to-end during order creation", async () => {
    const user = await createTestUser({ balance: 100 });
    const { service, provider } = await createTestService({ price: 10, min: 100, max: 5000 });
    await createCoupon({ code: "ORDER15", type: "PERCENTAGE", value: 15 });

    mockedGetAdapter.mockResolvedValue({
      provider,
      adapter: { createOrder: jest.fn().mockResolvedValue({ providerOrderId: "p1" }), getOrderStatus: jest.fn(), getBalance: jest.fn(), getServices: jest.fn() },
    } as any);

    const order = await createOrder({
      userId: user.id,
      serviceId: service.id,
      link: "https://instagram.com/x",
      quantity: 1000,
      couponCode: "order15",
    });

    // 10$/1000 * 1000 = 10, minus 15% = 8.5
    expect(Number(order.price)).toBeCloseTo(8.5);

    const usage = await prisma.couponUsage.findUnique({ where: { orderId: order.id } });
    expect(usage).not.toBeNull();
    expect(Number(usage!.discountAmount)).toBeCloseTo(1.5);

    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: "ORDER15" } });
    expect(coupon.usedCount).toBe(1);
  });
});
