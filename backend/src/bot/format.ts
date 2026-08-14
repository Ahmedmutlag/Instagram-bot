import { OrderStatus } from "@prisma/client";

export function formatMoney(amount: number, currency = "USD"): string {
  return `${amount.toFixed(2)} ${currency}`;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "⏳ قيد الانتظار",
  PROCESSING: "🔄 قيد التنفيذ",
  COMPLETED: "✅ مكتمل",
  PARTIAL: "⚠️ منفذ جزئياً",
  CANCELED: "🚫 ملغي",
  FAILED: "❌ فشل",
};

export function formatOrderStatus(status: OrderStatus): string {
  return STATUS_LABELS[status] ?? status;
}
