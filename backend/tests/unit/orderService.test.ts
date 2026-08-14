jest.mock("../../src/services/providerService", () => ({
  getAdapterForProvider: jest.fn(),
}));

import { getAdapterForProvider } from "../../src/services/providerService";
import {
  createOrder,
  syncOrderStatus,
  refundOrder,
  markOrderFailedAndRefund,
} from "../../src/services/orderService";
import { createTestUser, createTestService } from "../factories";
import { AppError } from "../../src/utils/errors";
import { prisma } from "../../src/lib/prisma";
import { orderSubmitQueue, notificationQueue } from "../../src/queues/queues";

const mockedGetAdapter = getAdapterForProvider as jest.MockedFunction<typeof getAdapterForProvider>;

describe("orderService", () => {
  it("creates an order, debits balance and submits it to the provider", async () => {
    const user = await createTestUser({ balance: 100 });
    const { service, provider } = await createTestService({ price: 3, min: 100, max: 5000 });

    mockedGetAdapter.mockResolvedValue({
      provider,
      adapter: {
        createOrder: jest.fn().mockResolvedValue({ providerOrderId: "prov-123" }),
        getOrderStatus: jest.fn(),
        getBalance: jest.fn(),
        getServices: jest.fn(),
      },
    } as any);

    const order = await createOrder({
      userId: user.id,
      serviceId: service.id,
      link: "https://instagram.com/somepost",
      quantity: 1000,
    });

    expect(order.status).toBe("PROCESSING");
    expect(order.providerOrderId).toBe("prov-123");
    expect(Number(order.price)).toBeCloseTo(3); // 3$/1000 * 1000
    expect(Number(order.cost)).toBeCloseTo(1); // 1$/1000 * 1000
    expect(Number(order.profit)).toBeCloseTo(2);

    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(freshUser.balance)).toBeCloseTo(97);
  });

  it("blocks order creation when the user has insufficient balance", async () => {
    const user = await createTestUser({ balance: 1 });
    const { service } = await createTestService({ price: 3, min: 100, max: 5000 });

    await expect(
      createOrder({ userId: user.id, serviceId: service.id, link: "https://instagram.com/x", quantity: 1000 })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });

    const orders = await prisma.order.count({ where: { userId: user.id } });
    expect(orders).toBe(0);
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(freshUser.balance)).toBe(1);
  });

  it("rejects an invalid target link", async () => {
    const user = await createTestUser({ balance: 100 });
    const { service } = await createTestService();
    await expect(
      createOrder({ userId: user.id, serviceId: service.id, link: "not-a-url", quantity: 1000 })
    ).rejects.toThrow(AppError);
  });

  it("rejects quantities outside the service min/max range", async () => {
    const user = await createTestUser({ balance: 1000 });
    const { service } = await createTestService({ min: 100, max: 1000 });
    await expect(
      createOrder({ userId: user.id, serviceId: service.id, link: "https://instagram.com/x", quantity: 5 })
    ).rejects.toThrow(AppError);
  });

  it("keeps the order PENDING (still charged) and queues a retry when the provider API fails", async () => {
    const user = await createTestUser({ balance: 100 });
    const { service, provider } = await createTestService({ price: 3, min: 100, max: 5000 });

    mockedGetAdapter.mockResolvedValue({
      provider,
      adapter: {
        createOrder: jest.fn().mockRejectedValue(new Error("Provider temporarily unavailable")),
        getOrderStatus: jest.fn(),
        getBalance: jest.fn(),
        getServices: jest.fn(),
      },
    } as any);

    const enqueueSpy = jest.spyOn(orderSubmitQueue, "add").mockResolvedValue({} as any);

    const order = await createOrder({
      userId: user.id,
      serviceId: service.id,
      link: "https://instagram.com/x",
      quantity: 1000,
    });

    expect(order.status).toBe("PENDING");
    expect(order.errorMessage).toContain("Provider temporarily unavailable");
    expect(enqueueSpy).toHaveBeenCalledWith("submit", { orderId: order.id });

    // Balance was already taken at order-creation time.
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(freshUser.balance)).toBeCloseTo(97);

    enqueueSpy.mockRestore();
  });

  it("refunds the user when a pending order's retries are exhausted", async () => {
    const user = await createTestUser({ balance: 100 });
    const { service, provider } = await createTestService({ price: 3, min: 100, max: 5000 });

    mockedGetAdapter.mockResolvedValue({
      provider,
      adapter: { createOrder: jest.fn().mockRejectedValue(new Error("down")), getOrderStatus: jest.fn(), getBalance: jest.fn(), getServices: jest.fn() },
    } as any);
    jest.spyOn(orderSubmitQueue, "add").mockResolvedValue({} as any);

    const order = await createOrder({
      userId: user.id,
      serviceId: service.id,
      link: "https://instagram.com/x",
      quantity: 1000,
    });
    expect(order.status).toBe("PENDING");

    await markOrderFailedAndRefund(order.id, "all retries exhausted");

    const failedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(failedOrder.status).toBe("FAILED");

    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(freshUser.balance)).toBeCloseTo(100);
  });

  it("syncs order status from the provider and notifies the user on change", async () => {
    const user = await createTestUser({ balance: 100 });
    const { service, provider } = await createTestService({ price: 3, min: 100, max: 5000 });

    mockedGetAdapter.mockResolvedValue({
      provider,
      adapter: {
        createOrder: jest.fn().mockResolvedValue({ providerOrderId: "prov-999" }),
        getOrderStatus: jest.fn().mockResolvedValue({ status: "COMPLETED", startCount: 10, remains: 0 }),
        getBalance: jest.fn(),
        getServices: jest.fn(),
      },
    } as any);

    const notifySpy = jest.spyOn(notificationQueue, "add").mockResolvedValue({} as any);

    const order = await createOrder({
      userId: user.id,
      serviceId: service.id,
      link: "https://instagram.com/x",
      quantity: 1000,
    });
    expect(order.status).toBe("PROCESSING");

    const synced = await syncOrderStatus(order.id);
    expect(synced?.status).toBe("COMPLETED");
    expect(synced?.remains).toBe(0);
    expect(notifySpy).toHaveBeenCalled();

    notifySpy.mockRestore();
  });

  it("refunds a cancelable order and blocks refunding a completed order", async () => {
    const user = await createTestUser({ balance: 100 });
    const { service, provider } = await createTestService({ price: 3, min: 100, max: 5000 });
    mockedGetAdapter.mockResolvedValue({
      provider,
      adapter: { createOrder: jest.fn().mockResolvedValue({ providerOrderId: "p1" }), getOrderStatus: jest.fn(), getBalance: jest.fn(), getServices: jest.fn() },
    } as any);

    const order = await createOrder({ userId: user.id, serviceId: service.id, link: "https://instagram.com/x", quantity: 1000 });

    const refunded = await refundOrder(order.id);
    expect(refunded.status).toBe("CANCELED");
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(freshUser.balance)).toBeCloseTo(100);

    await prisma.order.update({ where: { id: order.id }, data: { status: "COMPLETED" } });
    await expect(refundOrder(order.id)).rejects.toThrow(AppError);
  });
});
