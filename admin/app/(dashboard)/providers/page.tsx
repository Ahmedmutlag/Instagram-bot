"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import type { Provider } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { PageSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TableWrap, Table, Th, Td } from "@/components/Table";
import { StatusBadge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputClass } from "@/components/Field";

interface ProviderFormState {
  name: string;
  apiUrl: string;
  apiKey: string;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY_FORM: ProviderFormState = {
  name: "",
  apiUrl: "",
  apiKey: "",
  status: "ACTIVE",
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState<Provider | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [balanceMap, setBalanceMap] = useState<
    Record<string, { balance: number; currency: string } | "loading" | "error">
  >({});

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<Provider[]>("/providers")
      .then(setProviders)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleTestConnection(provider: Provider) {
    setTestingId(provider.id);
    try {
      const result = await api.post<{ success: boolean; message: string }>(
        `/providers/${provider.id}/test-connection`
      );
      if (result.success) {
        toast.success(result.message || "الاتصال ناجح");
      } else {
        toast.error(result.message || "فشل الاتصال بالمزود");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTestingId(null);
    }
  }

  async function handleViewBalance(provider: Provider) {
    setBalanceMap((prev) => ({ ...prev, [provider.id]: "loading" }));
    try {
      const result = await api.get<{ balance: number; currency: string }>(
        `/providers/${provider.id}/balance`
      );
      setBalanceMap((prev) => ({ ...prev, [provider.id]: result }));
    } catch (err) {
      setBalanceMap((prev) => ({ ...prev, [provider.id]: "error" }));
      toast.error(getErrorMessage(err));
    }
  }

  async function handleToggleStatus(provider: Provider) {
    const nextStatus = provider.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const updated = await api.patch<Provider>(`/providers/${provider.id}`, {
        status: nextStatus,
      });
      setProviders((prev) =>
        prev.map((p) => (p.id === provider.id ? updated : p))
      );
      toast.success(nextStatus === "ACTIVE" ? "تم تفعيل المزود" : "تم تعطيل المزود");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/providers/${deleting.id}`);
      toast.success("تم حذف المزود بنجاح");
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
        title="المزودون"
        description="إدارة مزودي الخدمات الخارجيين"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + إضافة مزود
          </Button>
        }
      />

      {loading && <PageSpinner />}
      {!loading && error && (
        <EmptyState title="تعذر تحميل المزودين" description={error} />
      )}
      {!loading && !error && providers.length === 0 && (
        <EmptyState title="لا يوجد مزودون بعد" />
      )}

      {!loading && !error && providers.length > 0 && (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>عنوان الـ API</Th>
                <Th>الحالة</Th>
                <Th>الرصيد</Th>
                <Th>إجراءات</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {providers.map((provider) => {
                const balance = balanceMap[provider.id];
                return (
                  <tr key={provider.id}>
                    <Td>
                      <Link
                        href={`/providers/${provider.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {provider.name}
                      </Link>
                    </Td>
                    <Td>
                      <span dir="ltr" className="text-xs text-slate-500">
                        {provider.apiUrl}
                      </span>
                    </Td>
                    <Td>
                      <button onClick={() => handleToggleStatus(provider)}>
                        <StatusBadge active={provider.status === "ACTIVE"} />
                      </button>
                    </Td>
                    <Td>
                      {!balance && (
                        <button
                          className="text-xs text-brand-600 hover:underline"
                          onClick={() => handleViewBalance(provider)}
                        >
                          عرض الرصيد
                        </button>
                      )}
                      {balance === "loading" && <PageSpinnerInline />}
                      {balance === "error" && (
                        <span className="text-xs text-rose-500">تعذر الجلب</span>
                      )}
                      {balance && typeof balance === "object" && (
                        <span className="text-xs font-medium">
                          {formatCurrency(balance.balance, balance.currency)}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={testingId === provider.id}
                          onClick={() => handleTestConnection(provider)}
                        >
                          اختبار اتصال
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing(provider);
                            setFormOpen(true);
                          }}
                        >
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleting(provider)}
                        >
                          حذف
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <ProviderFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        provider={editing}
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
        title="حذف المزود"
        description={`هل أنت متأكد من حذف المزود "${deleting?.name}"؟`}
        confirmLabel="حذف"
      />
    </div>
  );
}

function PageSpinnerInline() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-e-transparent align-middle" />
  );
}

function ProviderFormModal({
  open,
  onClose,
  provider,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  provider: Provider | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProviderFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (provider) {
      setForm({
        name: provider.name,
        apiUrl: provider.apiUrl,
        apiKey: "",
        status: provider.status,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, provider]);

  function updateField<K extends keyof ProviderFormState>(
    key: K,
    value: ProviderFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.apiUrl.trim()) {
      toast.error("يرجى تعبئة الاسم وعنوان الـ API");
      return;
    }
    if (!provider && !form.apiKey.trim()) {
      toast.error("يرجى إدخال مفتاح الـ API");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        apiUrl: form.apiUrl.trim(),
        status: form.status,
      };
      if (form.apiKey.trim()) {
        payload.apiKey = form.apiKey.trim();
      }
      if (provider) {
        await api.patch(`/providers/${provider.id}`, payload);
        toast.success("تم تحديث المزود بنجاح");
      } else {
        await api.post("/providers", payload);
        toast.success("تمت إضافة المزود بنجاح");
      }
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={provider ? "تعديل المزود" : "إضافة مزود"}
    >
      <form onSubmit={onSubmit}>
        <Field label="اسم المزود">
          <input
            className={inputClass}
            required
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
        </Field>
        <Field label="عنوان الـ API">
          <input
            className={`${inputClass} text-left`}
            dir="ltr"
            required
            value={form.apiUrl}
            onChange={(e) => updateField("apiUrl", e.target.value)}
            placeholder="https://provider.example.com/api"
          />
        </Field>
        <Field
          label="مفتاح الـ API"
          hint={
            provider
              ? "اتركه فارغاً للإبقاء على المفتاح الحالي دون تغيير"
              : undefined
          }
        >
          <input
            className={`${inputClass} text-left`}
            dir="ltr"
            type="password"
            value={form.apiKey}
            onChange={(e) => updateField("apiKey", e.target.value)}
            placeholder={provider ? "••••••••" : ""}
          />
        </Field>
        <Field label="الحالة">
          <select
            className={inputClass}
            value={form.status}
            onChange={(e) =>
              updateField("status", e.target.value as "ACTIVE" | "INACTIVE")
            }
          >
            <option value="ACTIVE">مفعّل</option>
            <option value="INACTIVE">معطل</option>
          </select>
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={submitting}>
            {provider ? "حفظ التعديلات" : "إضافة"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
