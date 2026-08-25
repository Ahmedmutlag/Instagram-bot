"use client";

import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Paginated, Provider, ProviderService, Service } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { PageSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TableWrap, Table, Th, Td } from "@/components/Table";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputClass } from "@/components/Field";

const LIMIT = 20;

interface ServiceFormState {
  name: string;
  description: string;
  category: string;
  providerId: string;
  providerServiceId: string;
  price: string;
  minQuantity: string;
  maxQuantity: string;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY_FORM: ServiceFormState = {
  name: "",
  description: "",
  category: "",
  providerId: "",
  providerServiceId: "",
  price: "",
  minQuantity: "",
  maxQuantity: "",
  status: "ACTIVE",
};

export default function ServicesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<Paginated<Service> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [translating, setTranslating] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<Paginated<Service>>("/services", {
        page,
        limit: LIMIT,
        status: status || undefined,
      })
      .then(setResult)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  async function handleToggleStatus(service: Service) {
    const nextStatus = service.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const updated = await api.patch<Service>(`/services/${service.id}`, {
        status: nextStatus,
      });
      setResult((prev) =>
        prev
          ? { ...prev, data: prev.data.map((s) => (s.id === service.id ? updated : s)) }
          : prev
      );
      toast.success(nextStatus === "ACTIVE" ? "تم تفعيل الخدمة" : "تم إيقاف الخدمة");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/services/${deleting.id}`);
      toast.success("تم حذف الخدمة بنجاح");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleTranslateNames() {
    setTranslating(true);
    try {
      const result = await api.post<{ translated: number }>("/services/translate-names", {});
      toast.success(`تمت ترجمة أسماء ${result.translated} خدمة إلى العربية`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="الخدمات"
        description="إدارة الخدمات المعروضة للمستخدمين"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setGenerateOpen(true)}>
              توليد خدمات تلقائياً
            </Button>
            <Button variant="secondary" loading={translating} onClick={handleTranslateNames}>
              ترجمة الأسماء للعربي
            </Button>
            <Button variant="danger" onClick={() => setBulkDeleteOpen(true)}>
              حذف الكل ما عدا...
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + إضافة خدمة
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <select
          className={`${inputClass} sm:max-w-[200px]`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">كل الحالات</option>
          <option value="ACTIVE">مفعّل</option>
          <option value="INACTIVE">موقف</option>
        </select>
      </div>

      {loading && <PageSpinner />}
      {!loading && error && (
        <EmptyState title="تعذر تحميل الخدمات" description={error} />
      )}
      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState title="لا توجد خدمات بعد" />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>الفئة</Th>
                <Th>المزود</Th>
                <Th>السعر</Th>
                <Th>التكلفة</Th>
                <Th>هامش الربح</Th>
                <Th>الحد الأدنى/الأقصى</Th>
                <Th>الحالة</Th>
                <Th>إجراءات</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.data.map((service) => (
                <tr key={service.id}>
                  <Td>{service.name}</Td>
                  <Td>{service.category ?? "—"}</Td>
                  <Td>{service.provider?.name ?? "—"}</Td>
                  <Td>{formatCurrency(service.price)}</Td>
                  <Td>{formatCurrency(service.costPrice)}</Td>
                  <Td>
                    {service.marginPercent !== undefined &&
                    service.marginPercent !== null
                      ? `${formatNumber(service.marginPercent)}%`
                      : "—"}
                  </Td>
                  <Td>
                    {formatNumber(service.minQuantity)} / {formatNumber(service.maxQuantity)}
                  </Td>
                  <Td>
                    <button onClick={() => handleToggleStatus(service)}>
                      <StatusBadge active={service.status === "ACTIVE"} />
                    </button>
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditing(service);
                          setFormOpen(true);
                        }}
                      >
                        تعديل
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleting(service)}
                      >
                        حذف
                      </Button>
                    </div>
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

      <ServiceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        service={editing}
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
        title="حذف الخدمة"
        description={`هل أنت متأكد من حذف الخدمة "${deleting?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
      />

      <GenerateServicesModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => {
          setGenerateOpen(false);
          load();
        }}
      />

      <BulkDeleteExceptModal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onDeleted={() => {
          setBulkDeleteOpen(false);
          load();
        }}
      />
    </div>
  );
}

function BulkDeleteExceptModal({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [keywords, setKeywords] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setKeywords("");
      setConfirming(false);
    }
  }, [open]);

  const keywordList = keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await api.post<{ deleted: number; kept: number; skippedHasOrders: number }>(
        "/services/bulk-delete-except",
        { keepKeywords: keywordList }
      );
      toast.success(
        `تم حذف ${result.deleted} خدمة، وبقي ${result.kept} خدمة${
          result.skippedHasOrders ? ` (تم تجاهل ${result.skippedHasOrders} خدمة عليها طلبات سابقة)` : ""
        }`
      );
      onDeleted();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="حذف الكل ما عدا...">
      {!confirming ? (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            يحذف كل الخدمات المعروضة للبيع اللي اسمها أو فئتها ما تحتوي على
            أي كلمة من الكلمات اللي تكتبها (بدون تأثير على الخدمات
            المستوردة الأصلية من المزود — تقدر تولّد خدمات جديدة منها لاحقاً).
          </p>
          <Field label="الكلمات اللي تحتفظ بخدماتها (افصل بينها بفاصلة)" hint="مثال: Instagram, TikTok, Twitter, Telegram, Facebook">
            <input
              className={inputClass}
              dir="ltr"
              placeholder="Instagram, TikTok, Twitter, Telegram, Facebook"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={keywordList.length === 0}
              onClick={() => setConfirming(true)}
            >
              متابعة
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-slate-700">
            هل أنت متأكد؟ راح تُحذف كل الخدمات المعروضة للبيع{" "}
            <strong>ما عدا</strong> اللي تحتوي على: {keywordList.join("، ")}.
            هذا الإجراء لا يمكن التراجع عنه.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              رجوع
            </Button>
            <Button type="button" variant="danger" loading={submitting} onClick={handleConfirm}>
              نعم، احذف
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function GenerateServicesModal({
  open,
  onClose,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [markupPercent, setMarkupPercent] = useState("50");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProviderId("");
    setMarkupPercent("50");
    api
      .get<Provider[]>("/providers")
      .then(setProviders)
      .catch((err) => toast.error(getErrorMessage(err)));
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!providerId) {
      toast.error("يرجى اختيار المزود");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.post<{ created: number; skipped: number }>(
        "/services/bulk-generate",
        { providerId, markupPercent: Number(markupPercent) }
      );
      toast.success(
        `تم إنشاء ${result.created} خدمة للبيع${result.skipped ? ` (تم تجاهل ${result.skipped} خدمة معروضة مسبقاً)` : ""}`
      );
      onGenerated();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="توليد خدمات تلقائياً">
      <form onSubmit={onSubmit}>
        <p className="mb-4 text-sm text-slate-600">
          ينشئ خدمة معروضة للبيع لكل خدمة مستوردة من المزود المحدد وليس لها
          خدمة بيع بعد، بسعر = التكلفة + هامش الربح. تقدر تعدّل الأسماء
          والأسعار فردياً بعدها.
        </p>
        <Field label="المزود">
          <select
            className={inputClass}
            required
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            <option value="">اختر المزود</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="هامش الربح (%)">
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            className={inputClass}
            value={markupPercent}
            onChange={(e) => setMarkupPercent(e.target.value)}
          />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={submitting}>
            توليد
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ServiceFormModal({
  open,
  onClose,
  service,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  service: Service | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ServiceFormState>(EMPTY_FORM);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mappedServices, setMappedServices] = useState<ProviderService[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get<Provider[]>("/providers")
      .then(setProviders)
      .catch((err) => toast.error(getErrorMessage(err)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (service) {
      setForm({
        name: service.name,
        description: service.description ?? "",
        category: service.category ?? "",
        providerId: service.providerId,
        providerServiceId: service.providerServiceId,
        price: String(service.price),
        minQuantity: String(service.minQuantity),
        maxQuantity: String(service.maxQuantity),
        status: service.status,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, service]);

  useEffect(() => {
    if (!open || !form.providerId) {
      setMappedServices([]);
      return;
    }
    api
      .get<ProviderService[]>(`/providers/${form.providerId}/mapped-services`)
      .then(setMappedServices)
      .catch((err) => toast.error(getErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.providerId]);

  function updateField<K extends keyof ServiceFormState>(
    key: K,
    value: ServiceFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("يرجى إدخال اسم الخدمة");
      return;
    }
    if (!form.providerId || !form.providerServiceId) {
      toast.error("يرجى اختيار المزود وخدمة المزود");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      providerId: form.providerId,
      providerServiceId: form.providerServiceId,
      price: Number(form.price),
      minQuantity: Number(form.minQuantity),
      maxQuantity: Number(form.maxQuantity),
      status: form.status,
    };
    setSubmitting(true);
    try {
      if (service) {
        await api.patch(`/services/${service.id}`, payload);
        toast.success("تم تحديث الخدمة بنجاح");
      } else {
        await api.post("/services", payload);
        toast.success("تمت إضافة الخدمة بنجاح");
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
      title={service ? "تعديل الخدمة" : "إضافة خدمة"}
      widthClass="max-w-2xl"
    >
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="اسم الخدمة">
            <input
              className={inputClass}
              required
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </Field>
          <Field label="الفئة">
            <input
              className={inputClass}
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="الوصف">
              <textarea
                className={inputClass}
                rows={2}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </Field>
          </div>
          <Field label="المزود">
            <select
              className={inputClass}
              required
              value={form.providerId}
              onChange={(e) => {
                updateField("providerId", e.target.value);
                updateField("providerServiceId", "");
              }}
            >
              <option value="">اختر المزود</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="خدمة المزود">
            <select
              className={inputClass}
              required
              disabled={!form.providerId}
              value={form.providerServiceId}
              onChange={(e) => updateField("providerServiceId", e.target.value)}
            >
              <option value="">اختر خدمة المزود</option>
              {mappedServices.map((ms) => (
                <option key={ms.id} value={ms.id}>
                  {ms.name} ({formatCurrency(ms.costPrice)})
                </option>
              ))}
            </select>
          </Field>
          <Field label="السعر">
            <input
              type="number"
              step="0.01"
              min="0"
              required
              className={inputClass}
              value={form.price}
              onChange={(e) => updateField("price", e.target.value)}
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
              <option value="INACTIVE">موقف</option>
            </select>
          </Field>
          <Field label="الحد الأدنى للكمية">
            <input
              type="number"
              min="1"
              required
              className={inputClass}
              value={form.minQuantity}
              onChange={(e) => updateField("minQuantity", e.target.value)}
            />
          </Field>
          <Field label="الحد الأقصى للكمية">
            <input
              type="number"
              min="1"
              required
              className={inputClass}
              value={form.maxQuantity}
              onChange={(e) => updateField("maxQuantity", e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={submitting}>
            {service ? "حفظ التعديلات" : "إضافة"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
