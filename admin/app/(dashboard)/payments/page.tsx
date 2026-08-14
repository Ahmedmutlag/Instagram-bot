"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Paginated, Payment } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { PageSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TableWrap, Table, Th, Td } from "@/components/Table";
import { Pagination } from "@/components/Pagination";
import { PaymentStatusBadge } from "@/components/Badge";
import { inputClass } from "@/components/Field";

const LIMIT = 20;

export default function PaymentsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Payment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [status]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<Paginated<Payment>>("/payments", {
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
  }, [status, page]);

  return (
    <div>
      <PageHeader title="المدفوعات" description="سجل عمليات الإيداع والدفع" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <select
          className={`${inputClass} sm:max-w-[200px]`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">كل الحالات</option>
          <option value="PENDING">معلقة</option>
          <option value="SUCCESS">ناجحة</option>
          <option value="FAILED">فاشلة</option>
        </select>
      </div>

      {loading && <PageSpinner />}
      {!loading && error && (
        <EmptyState title="تعذر تحميل المدفوعات" description={error} />
      )}
      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState title="لا توجد مدفوعات مطابقة" />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>المستخدم</Th>
                <Th>المبلغ</Th>
                <Th>الطريقة</Th>
                <Th>الحالة</Th>
                <Th>التاريخ</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.data.map((payment) => (
                <tr key={payment.id}>
                  <Td>
                    {payment.user
                      ? [payment.user.firstName, payment.user.lastName]
                          .filter(Boolean)
                          .join(" ") || payment.user.username || "—"
                      : "—"}
                  </Td>
                  <Td>{formatCurrency(payment.amount)}</Td>
                  <Td>{payment.method ?? "—"}</Td>
                  <Td>
                    <PaymentStatusBadge status={payment.status} />
                  </Td>
                  <Td>{formatDate(payment.createdAt)}</Td>
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
    </div>
  );
}
