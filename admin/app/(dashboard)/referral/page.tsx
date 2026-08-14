"use client";

import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import type { Settings } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { PageSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { Field, inputClass } from "@/components/Field";

export default function ReferralPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [percent, setPercent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<Settings>("/settings")
      .then((data) => setPercent(String(data.referralPercent ?? 0)))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(percent);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      toast.error("يرجى إدخال نسبة صحيحة بين 0 و100");
      return;
    }
    setSaving(true);
    try {
      await api.patch<Settings>("/settings", { referralPercent: value });
      toast.success("تم تحديث نسبة عمولة الإحالة بنجاح");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="نظام الإحالة"
        description="إعداد نسبة العمولة التي يحصل عليها المستخدمون عند إحالة مستخدمين جدد"
      />

      {loading && <PageSpinner />}
      {!loading && error && (
        <EmptyState title="تعذر تحميل الإعدادات" description={error} />
      )}

      {!loading && !error && (
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            عند تسجيل مستخدم جديد عبر رابط إحالة أحد المستخدمين، يحصل المُحيل على
            نسبة من قيمة الطلبات التي ينفذها المستخدم المُحال، تُضاف تلقائياً إلى
            رصيده. يمكنك ضبط هذه النسبة من هنا.
          </p>
          <form onSubmit={onSubmit}>
            <Field label="نسبة عمولة الإحالة (%)">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                className={inputClass}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={saving}>
              حفظ
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
