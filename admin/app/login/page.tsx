"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getErrorMessage } from "@/lib/auth";
import { Button } from "@/components/Button";
import { inputClass } from "@/components/Field";

export default function LoginPage() {
  const { login, admin, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && admin) {
      router.replace("/dashboard");
    }
  }, [loading, admin, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-700">لوحة إدارة SMM</h1>
          <p className="mt-1 text-sm text-slate-500">
            سجّل الدخول للوصول إلى لوحة التحكم
          </p>
        </div>
        <form onSubmit={onSubmit} noValidate>
          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              البريد الإلكتروني
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              dir="ltr"
              className={`${inputClass} text-left`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              كلمة المرور
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              dir="ltr"
              className={`${inputClass} text-left`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {error && (
            <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={submitting}>
            تسجيل الدخول
          </Button>
        </form>
      </div>
    </div>
  );
}
