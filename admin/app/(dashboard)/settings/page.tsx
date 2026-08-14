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

interface SettingsFormState {
  botName: string;
  botToken: string;
  currency: string;
  language: string;
  supportUsername: string;
  minDeposit: string;
  referralPercent: string;
}

const EMPTY_FORM: SettingsFormState = {
  botName: "",
  botToken: "",
  currency: "",
  language: "",
  supportUsername: "",
  minDeposit: "",
  referralPercent: "",
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsFormState>(EMPTY_FORM);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<Settings>("/settings")
      .then((data) => {
        setForm({
          botName: String(data.botName ?? ""),
          botToken: "",
          currency: String(data.currency ?? ""),
          language: String(data.language ?? ""),
          supportUsername: String(data.supportUsername ?? ""),
          minDeposit: data.minDeposit !== undefined ? String(data.minDeposit) : "",
          referralPercent:
            data.referralPercent !== undefined ? String(data.referralPercent) : "",
        });
        setHasStoredToken(Boolean(data.botToken));
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof SettingsFormState>(
    key: K,
    value: SettingsFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      botName: form.botName.trim(),
      currency: form.currency.trim(),
      language: form.language.trim(),
      supportUsername: form.supportUsername.trim(),
      minDeposit: form.minDeposit ? Number(form.minDeposit) : 0,
      referralPercent: form.referralPercent ? Number(form.referralPercent) : 0,
    };
    if (form.botToken.trim()) {
      payload.botToken = form.botToken.trim();
    }
    setSaving(true);
    try {
      await api.patch<Settings>("/settings", payload);
      toast.success("تم حفظ الإعدادات بنجاح");
      setForm((prev) => ({ ...prev, botToken: "" }));
      if (payload.botToken) setHasStoredToken(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="الإعدادات" description="الإعدادات العامة للمنصة والبوت" />

      {loading && <PageSpinner />}
      {!loading && error && (
        <EmptyState title="تعذر تحميل الإعدادات" description={error} />
      )}

      {!loading && !error && (
        <form
          onSubmit={onSubmit}
          className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="اسم البوت">
              <input
                className={inputClass}
                value={form.botName}
                onChange={(e) => updateField("botName", e.target.value)}
              />
            </Field>
            <Field label="حساب الدعم">
              <input
                className={`${inputClass} text-left`}
                dir="ltr"
                value={form.supportUsername}
                onChange={(e) => updateField("supportUsername", e.target.value)}
                placeholder="@support"
              />
            </Field>
            <Field label="العملة">
              <input
                className={`${inputClass} text-left`}
                dir="ltr"
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
                placeholder="USD"
              />
            </Field>
            <Field label="اللغة">
              <input
                className={inputClass}
                value={form.language}
                onChange={(e) => updateField("language", e.target.value)}
                placeholder="ar"
              />
            </Field>
            <Field label="الحد الأدنى للإيداع">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={form.minDeposit}
                onChange={(e) => updateField("minDeposit", e.target.value)}
              />
            </Field>
            <Field label="نسبة الإحالة (%)">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className={inputClass}
                value={form.referralPercent}
                onChange={(e) => updateField("referralPercent", e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Telegram Bot Token"
                hint={
                  hasStoredToken
                    ? "يوجد رمز محفوظ حالياً؛ اتركه فارغاً للإبقاء عليه دون تغيير"
                    : "لم يتم ضبط أي رمز بعد"
                }
              >
                <input
                  className={`${inputClass} text-left`}
                  dir="ltr"
                  type="password"
                  value={form.botToken}
                  onChange={(e) => updateField("botToken", e.target.value)}
                  placeholder={hasStoredToken ? "••••••••••••••••" : "أدخل رمز البوت"}
                />
              </Field>
            </div>
          </div>
          <Button type="submit" loading={saving}>
            حفظ التغييرات
          </Button>
        </form>
      )}
    </div>
  );
}
