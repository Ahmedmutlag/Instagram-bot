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

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_PASSWORD_FORM: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsFormState>(EMPTY_FORM);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(EMPTY_PASSWORD_FORM);
  const [changingPassword, setChangingPassword] = useState(false);

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

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      toast.error("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }
    setChangingPassword(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success("تم تغيير كلمة المرور بنجاح");
      setPasswordForm(EMPTY_PASSWORD_FORM);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setChangingPassword(false);
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

      {!loading && !error && (
        <form
          onSubmit={onChangePassword}
          className="mt-6 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            تغيير كلمة المرور
          </h2>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="كلمة المرور الحالية">
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                  }
                  required
                />
              </Field>
            </div>
            <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل">
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                }
                required
                minLength={8}
              />
            </Field>
            <Field label="تأكيد كلمة المرور الجديدة">
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                }
                required
                minLength={8}
              />
            </Field>
          </div>
          <Button type="submit" loading={changingPassword}>
            تغيير كلمة المرور
          </Button>
        </form>
      )}
    </div>
  );
}
