"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Order } from "@/types";
import { OrderStatusBadge } from "./Badge";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";

const REFUNDABLE_STATUSES = ["PENDING", "PROCESSING", "FAILED"];

export function OrderDetailDrawer({
  order,
  onClose,
  onChanged,
}: {
  order: Order | null;
  onClose: () => void;
  onChanged: (order: Order) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);

  useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [order, onClose]);

  if (!order || typeof document === "undefined") return null;

  async function handleSync() {
    if (!order) return;
    setSyncing(true);
    try {
      const updated = await api.post<Order>(`/orders/${order.id}/sync`);
      onChanged(updated);
      toast.success("تم تحديث حالة الطلب من المزود");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  async function handleRefund() {
    if (!order) return;
    setRefunding(true);
    try {
      const updated = await api.post<Order>(`/orders/${order.id}/refund`);
      onChanged(updated);
      toast.success("تم استرجاع المبلغ إلى رصيد المستخدم");
      setRefundConfirmOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRefunding(false);
    }
  }

  const canRefund = REFUNDABLE_STATUSES.includes(order.status);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-800">
            تفاصيل الطلب #{order.orderNumber}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 px-5 py-4">
          <Row label="الحالة">
            <OrderStatusBadge status={order.status} />
          </Row>
          <Row label="المستخدم">
            {order.user
              ? [order.user.firstName, order.user.lastName]
                  .filter(Boolean)
                  .join(" ") ||
                order.user.username ||
                order.user.telegramId
              : "—"}
          </Row>
          <Row label="الخدمة">{order.service?.name ?? "—"}</Row>
          <Row label="المزود">{order.provider?.name ?? "—"}</Row>
          <Row label="معرف طلب المزود">
            <span dir="ltr">{order.providerOrderId ?? "—"}</span>
          </Row>
          <Row label="الرابط">
            {order.link ? (
              <a
                href={order.link}
                target="_blank"
                rel="noreferrer"
                className="break-all text-brand-600 hover:underline"
                dir="ltr"
              >
                {order.link}
              </a>
            ) : (
              "—"
            )}
          </Row>
          <Row label="الكمية">{order.quantity}</Row>
          <Row label="السعر">{formatCurrency(order.price)}</Row>
          <Row label="التكلفة">{formatCurrency(order.costPrice)}</Row>
          <Row label="الربح">{formatCurrency(order.profit)}</Row>
          <Row label="تاريخ الإنشاء">{formatDate(order.createdAt)}</Row>
          <Row label="آخر تحديث">{formatDate(order.updatedAt)}</Row>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4">
          <Button variant="secondary" onClick={handleSync} loading={syncing}>
            متابعة الطلب
          </Button>
          <Button
            variant="danger"
            onClick={() => setRefundConfirmOpen(true)}
            disabled={!canRefund}
          >
            استرجاع
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={refundConfirmOpen}
        onClose={() => setRefundConfirmOpen(false)}
        onConfirm={handleRefund}
        loading={refunding}
        title="استرجاع الطلب"
        description="سيتم استرجاع مبلغ الطلب إلى رصيد المستخدم وتغيير حالته إلى ملغى. هل أنت متأكد؟"
        confirmLabel="استرجاع"
      />
    </div>,
    document.body
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-left font-medium text-slate-800">{children}</span>
    </div>
  );
}
