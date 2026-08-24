"use client";

import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
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
import { Field, inputClass } from "@/components/Field";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const LIMIT = 20;

export default function PaymentsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Payment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState<Payment | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [rejecting, setRejecting] = useState<Payment | null>(null);

  useEffect(() => {
    setPage(1);
  }, [status]);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<Paginated<Payment>>("/payments", {
        status: status || undefined,
        page,
        limit: LIMIT,
      })
      .then(setResult)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  async function handleConfirm() {
    if (!confirming) return;
    setConfirmLoading(true);
    try {
      await api.post(`/payments/${confirming.id}/confirm`);
      toast.success("تم تأكيد الإيداع وإضافة الرصيد للمستخدم");
      setConfirming(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setConfirmLoading(false);
    }
  }

  const isPendingManual = (p: Payment) => p.status === "PENDING" && p.method === "manual";

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
                <Th>إجراءات</Th>
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
                  <Td>{payment.method === "manual" ? "تحويل يدوي" : payment.method ?? "—"}</Td>
                  <Td>
                    <PaymentStatusBadge status={payment.status} />
                  </Td>
                  <Td>{formatDate(payment.createdAt)}</Td>
                  <Td>
                    {isPendingManual(payment) ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setConfirming(payment)}>
                          تأكيد
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRejecting(payment)}>
                          رفض
                        </Button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </Td>
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

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={handleConfirm}
        loading={confirmLoading}
        title="تأكيد الإيداع"
        description={`هل تأكدت من استلام مبلغ ${confirming ? formatCurrency(confirming.amount) : ""}؟ سيتم إضافته لرصيد المستخدم فوراً.`}
        confirmLabel="تأكيد وإضافة الرصيد"
      />

      <RejectModal payment={rejecting} onClose={() => setRejecting(null)} onRejected={load} />
    </div>
  );
}

function RejectModal({
  payment,
  onClose,
  onRejected,
}: {
  payment: Payment | null;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!payment) setReason("");
  }, [payment]);

  if (!payment) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!payment) return;
    setSubmitting(true);
    try {
      await api.post(`/payments/${payment.id}/reject`, { reason: reason.trim() || undefined });
      toast.success("تم رفض عملية الإيداع");
      onClose();
      onRejected();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={!!payment} onClose={onClose} title="رفض عملية الإيداع">
      <form onSubmit={onSubmit}>
        <Field label="السبب (اختياري)">
          <textarea
            className={inputClass}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: لم يصل التحويل، أو رقم مرجع غير صحيح"
          />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" variant="danger" loading={submitting}>
            تأكيد الرفض
          </Button>
        </div>
      </form>
    </Modal>
  );
}
