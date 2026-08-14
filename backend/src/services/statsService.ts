import { prisma } from "../lib/prisma";
import { toNumber } from "../utils/money";

export async function getDashboardStats() {
  const [totalUsers, totalOrders, completedOrders, pendingOrders, sums] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "COMPLETED" } }),
    prisma.order.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.order.aggregate({
      where: { status: { notIn: ["CANCELED", "FAILED"] } },
      _sum: { price: true, cost: true, profit: true },
    }),
  ]);

  return {
    totalUsers,
    totalOrders,
    completedOrders,
    pendingOrders,
    totalSales: toNumber(sums._sum.price),
    totalCost: toNumber(sums._sum.cost),
    totalProfit: toNumber(sums._sum.profit),
  };
}
