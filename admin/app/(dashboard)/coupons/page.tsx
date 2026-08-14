"use client";

import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { Coupon, CouponType } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { PageSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TableWrap, Table, Th, Td } from "@/components/Table";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputClass } from "@/components/Field";

interface CouponFormState {
  code: string;
  type: CouponType;
  value: string;
  maxUses: string;
  minOrderAmount: string;
  expiresAt: string;
  isActive: boolean;
}

const EMPTY_FORM: CouponFormState = {
  code: "",
  type: "PERCENTAGE",
  value: "",
  maxUses: "",
  minOrderAmount: "",
  expiresAt: "",
  isActive: true,
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<Coupon[]>("/coupons")
      .then(setCoupons)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggleActive(coupon: Coupon) {
    try {
      const updated = await api.patch<Coupon>(`/coupons/${coupon.id}`, {
        isActive: !coupon.isActive,
      });
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? updated : c)));
      toast.success(updated.isActive ? "تم تفعيل الكوبون" : "تم إيقاف الكوبون");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/coupons/${deleting.id}`);
      toast.success("تم حذف الكوبون بنجاح");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="الكوبونات"
        description="إدارة كوبونات الخصم"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + إضافة كوبون
          </Button>
        }
      />

      {loading && <PageSpinner />}
      {!loading && error && (
        <EmptyState title="تعذر تحميل الكوبونات" description={error} />
      )}
      {!loading && !error && coupons.length === 0 && (
        <EmptyState title="لا توجد كوبونات بعد" />
      )}

      {!loading && !error && coupons.length > 0 && (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>الكود</Th>
                <Th>النوع</Th>
                <Th>القيمة</Th>
                <Th>الحد الأدنى للطلب</Th>
                <Th>عدد الاستخدامات</Th>
                <Th>تاريخ الانتهاء</Th>
                <Th>الحالة</Th>
                <Th>إجراءات</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <Td>
                    <span className="font-mono font-semibold" dir="ltr">
                      {coupon.code}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone="blue">
                      {coupon.type === "PERCENTAGE" ? "نسبة مئوية" : "مبلغ ثابت"}
                    </Badge>
                  </Td>
                  <Td>
                    {coupon.type === "PERCENTAGE"
                      ? `${formatNumber(coupon.value)}%`
                      : formatCurrency(coupon.value)}
                  </Td>
                  <Td>
                    {coupon.minOrderAmount
                      ? formatCurrency(coupon.minOrderAmount)
                      : "—"}
                  </Td>
                  <Td>
                    {formatNumber(coupon.usedCount ?? 0)} /{" "}
                    {coupon.maxUses ? formatNumber(coupon.maxUses) : "∞"}
                  </Td>
                  <Td>{coupon.expiresAt ? formatDate(coupon.expiresAt) : "بلا انتهاء"}</Td>
                  <Td>
                    <button onClick={() => handleToggleActive(coupon)}>
                      <Badge tone={coupon.isActive ? "green" : "gray"}>
                        {coupon.isActive ? "مفعّل" : "موقف"}
                      </Badge>
                    </button>
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditing(coupon);
                          setFormOpen(true);
                        }}
                      >
                        تعديل
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleting(coupon)}
                      >
                        حذف
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <CouponFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        coupon={editing}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="حذف الكوبون"
        description={`هل أنت متأكد من حذف الكوبون "${deleting?.code}"؟`}
        confirmLabel="حذف"
      />
    </div>
  );
}

function CouponFormModal({
  open,
  onClose,
  coupon,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  coupon: Coupon | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CouponFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (coupon) {
      setForm({
        code: coupon.code,
        type: coupon.type,
        value: String(coupon.value),
        maxUses: coupon.maxUses ? String(coupon.maxUses) : "",
        minOrderAmount: coupon.minOrderAmount ? String(coupon.minOrderAmount) : "",
        expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "",
        isActive: coupon.isActive,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, coupon]);

  function updateField<K extends keyof CouponFormState>(
    key: K,
    value: CouponFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) {
      toast.error("يرجى إدخال كود الكوبون");
      return;
    }
    const payload: Record<string, unknown> = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      maxUses: form.maxUses ? Number(form.maxUses) : undefined,
      minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      isActive: form.isActive,
    };
    setSubmitting(true);
    try {
      if (coupon) {
        await api.patch(`/coupons/${coupon.id}`, payload);
        toast.success("تم تحديث الكوبون بنجاح");
      } else {
        await api.post("/coupons", payload);
        toast.success("تمت إضافة الكوبون بنجاح");
      }
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={coupon ? "تعديل الكوبون" : "إضافة كوبون"}>
      <form onSubmit={onSubmit}>
        <Field label="كود الكوبون">
          <input
            className={`${inputClass} text-left font-mono`}
            dir="ltr"
            required
            value={form.code}
            onChange={(e) => updateField("code", e.target.value)}
          />
        </Field>
        <Field label="نوع الخصم">
          <select
            className={inputClass}
            value={form.type}
            onChange={(e) => updateField("type", e.target.value as CouponType)}
          >
            <option value="PERCENTAGE">نسبة مئوية</option>
            <option value="FIXED">مبلغ ثابت</option>
          </select>
        </Field>
        <Field label={form.type === "PERCENTAGE" ? "القيمة (%)" : "القيمة"}>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            className={inputClass}
            value={form.value}
            onChange={(e) => updateField("value", e.target.value)}
          />
        </Field>
        <Field label="الحد الأقصى للاستخدام (اختياري)">
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.maxUses}
            onChange={(e) => updateField("maxUses", e.target.value)}
          />
        </Field>
        <Field label="الحد الأدنى لمبلغ الطلب (اختياري)">
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            value={form.minOrderAmount}
            onChange={(e) => updateField("minOrderAmount", e.target.value)}
          />
        </Field>
        <Field label="تاريخ الانتهاء (اختياري)">
          <input
            type="date"
            className={inputClass}
            value={form.expiresAt}
            onChange={(e) => updateField("expiresAt", e.target.value)}
          />
        </Field>
        <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => updateField("isActive", e.target.checked)}
          />
          الكوبون مفعّل
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={submitting}>
            {coupon ? "حفظ التعديلات" : "إضافة"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
