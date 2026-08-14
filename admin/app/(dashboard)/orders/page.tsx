"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Order, Paginated } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { PageSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TableWrap, Table, Th, Td } from "@/components/Table";
import { Pagination } from "@/components/Pagination";
import { OrderStatusBadge } from "@/components/Badge";
import { inputClass } from "@/components/Field";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";

const LIMIT = 20;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "كل الحالات" },
  { value: "PENDING", label: "معلق" },
  { value: "PROCESSING", label: "قيد المعالجة" },
  { value: "IN_PROGRESS", label: "قيد التنفيذ" },
  { value: "COMPLETED", label: "مكتمل" },
  { value: "PARTIAL", label: "منجز جزئياً" },
  { value: "CANCELED", label: "ملغى" },
  { value: "FAILED", label: "فشل" },
  { value: "REFUNDED", label: "مسترجع" },
];

function OrdersContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Order> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, status]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<Paginated<Order>>("/orders", {
        query: debouncedQuery,
        status: status || undefined,
        page,
        limit: LIMIT,
      })
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, status, page]);

  return (
    <div>
      <PageHeader title="الطلبات" description="متابعة طلبات المستخدمين وحالتها" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          className={`${inputClass} sm:max-w-xs`}
          placeholder="بحث برقم الطلب أو المستخدم..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={`${inputClass} sm:max-w-[200px]`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <PageSpinner />}
      {!loading && error && (
        <EmptyState title="تعذر تحميل الطلبات" description={error} />
      )}
      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState title="لا توجد طلبات مطابقة" />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>رقم الطلب</Th>
                <Th>المستخدم</Th>
                <Th>الخدمة</Th>
                <Th>المزود</Th>
                <Th>معرف طلب المزود</Th>
                <Th>الحالة</Th>
                <Th>السعر</Th>
                <Th>التكلفة</Th>
                <Th>الربح</Th>
                <Th>التاريخ</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.data.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <Td>{order.orderNumber}</Td>
                  <Td>
                    {order.user
                      ? [order.user.firstName, order.user.lastName]
                          .filter(Boolean)
                          .join(" ") ||
                        order.user.username ||
                        order.user.telegramId
                      : "—"}
                  </Td>
                  <Td>{order.service?.name ?? "—"}</Td>
                  <Td>{order.provider?.name ?? "—"}</Td>
                  <Td>
                    <span dir="ltr">{order.providerOrderId ?? "—"}</span>
                  </Td>
                  <Td>
                    <OrderStatusBadge status={order.status} />
                  </Td>
                  <Td>{formatCurrency(order.price)}</Td>
                  <Td>{formatCurrency(order.costPrice)}</Td>
                  <Td>{formatCurrency(order.profit)}</Td>
                  <Td>{formatDate(order.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={page}
            limit={LIMIT}
            total={result.meta.total}
            onPageChange={setPage}
          />
        </TableWrap>
      )}

      <OrderDetailDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onChanged={(updated) => {
          setSelectedOrder(updated);
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  data: prev.data.map((o) => (o.id === updated.id ? updated : o)),
                }
              : prev
          );
        }}
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <OrdersContent />
    </Suspense>
  );
}
