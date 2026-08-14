"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Provider, ProviderService, RemoteService } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { PageSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TableWrap, Table, Th, Td } from "@/components/Table";
import { StatusBadge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputClass } from "@/components/Field";

export default function ProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const providerId = params.id;

  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [remoteServices, setRemoteServices] = useState<RemoteService[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const [mappedServices, setMappedServices] = useState<ProviderService[]>([]);
  const [mappedLoading, setMappedLoading] = useState(true);

  const [importTarget, setImportTarget] = useState<RemoteService | null>(null);
  const [editingMapped, setEditingMapped] = useState<ProviderService | null>(null);
  const [deletingMapped, setDeletingMapped] = useState<ProviderService | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadProvider = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .get<Provider>(`/providers/${providerId}`)
      .then(setProvider)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [providerId]);

  const loadMapped = useCallback(() => {
    setMappedLoading(true);
    return api
      .get<ProviderService[]>(`/providers/${providerId}/mapped-services`)
      .then(setMappedServices)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setMappedLoading(false));
  }, [providerId]);

  useEffect(() => {
    loadProvider();
    loadMapped();
  }, [loadProvider, loadMapped]);

  function loadRemote() {
    setRemoteLoading(true);
    setRemoteError(null);
    api
      .get<RemoteService[]>(`/providers/${providerId}/remote-services`)
      .then(setRemoteServices)
      .catch((err) => setRemoteError(getErrorMessage(err)))
      .finally(() => setRemoteLoading(false));
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const result = await api.post<{ success: boolean; message: string }>(
        `/providers/${providerId}/test-connection`
      );
      if (result.success) toast.success(result.message || "الاتصال ناجح");
      else toast.error(result.message || "فشل الاتصال بالمزود");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTesting(false);
    }
  }

  async function handleDeleteMapped() {
    if (!deletingMapped) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/provider-services/${deletingMapped.id}`);
      toast.success("تم حذف الخدمة المستوردة");
      setDeletingMapped(null);
      loadMapped();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  const mappedExternalIds = new Set(mappedServices.map((m) => m.externalServiceId));

  return (
    <div>
      <button
        onClick={() => router.push("/providers")}
        className="mb-4 text-sm text-brand-600 hover:underline"
      >
        ← العودة إلى المزودين
      </button>

      {loading && <PageSpinner />}
      {!loading && error && (
        <EmptyState title="تعذر تحميل بيانات المزود" description={error} />
      )}

      {!loading && !error && provider && (
        <>
          <PageHeader
            title={provider.name}
            description={provider.apiUrl}
            actions={
              <>
                <Button variant="secondary" onClick={handleTestConnection} loading={testing}>
                  اختبار اتصال
                </Button>
                <StatusPill active={provider.status === "ACTIVE"} />
              </>
            }
          />

          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">
                إدارة خدمات المزود
              </h2>
              <Button variant="secondary" size="sm" onClick={loadRemote} loading={remoteLoading}>
                جلب الخدمات من المزود
              </Button>
            </div>

            {remoteError && (
              <EmptyState title="تعذر جلب الخدمات" description={remoteError} />
            )}

            {!remoteError && remoteServices && remoteServices.length === 0 && (
              <EmptyState title="لا توجد خدمات متاحة من هذا المزود" />
            )}

            {!remoteError && remoteServices && remoteServices.length > 0 && (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>معرف الخدمة</Th>
                      <Th>الاسم</Th>
                      <Th>الفئة</Th>
                      <Th>السعر</Th>
                      <Th>الحد الأدنى/الأقصى</Th>
                      <Th>إجراء</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {remoteServices.map((rs) => {
                      const imported = mappedExternalIds.has(rs.externalServiceId);
                      return (
                        <tr key={rs.externalServiceId}>
                          <Td>
                            <span dir="ltr">{rs.externalServiceId}</span>
                          </Td>
                          <Td>{rs.name}</Td>
                          <Td>{rs.category ?? "—"}</Td>
                          <Td>{formatCurrency(rs.rate)}</Td>
                          <Td>
                            {formatNumber(rs.min)} / {formatNumber(rs.max)}
                          </Td>
                          <Td>
                            {imported ? (
                              <span className="text-xs text-emerald-600">
                                تم الاستيراد
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setImportTarget(rs)}
                              >
                                استيراد
                              </Button>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-base font-bold text-slate-800">
              الخدمات المستوردة
            </h2>
            {mappedLoading && <PageSpinner />}
            {!mappedLoading && mappedServices.length === 0 && (
              <EmptyState title="لم يتم استيراد أي خدمات بعد" />
            )}
            {!mappedLoading && mappedServices.length > 0 && (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>الاسم</Th>
                      <Th>الفئة</Th>
                      <Th>التكلفة</Th>
                      <Th>الحد الأدنى/الأقصى</Th>
                      <Th>إجراءات</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mappedServices.map((ms) => (
                      <tr key={ms.id}>
                        <Td>{ms.name}</Td>
                        <Td>{ms.category ?? "—"}</Td>
                        <Td>{formatCurrency(ms.costPrice)}</Td>
                        <Td>
                          {formatNumber(ms.minQuantity)} / {formatNumber(ms.maxQuantity)}
                        </Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setEditingMapped(ms)}
                            >
                              تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setDeletingMapped(ms)}
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
          </section>
        </>
      )}

      <ImportModal
        providerId={providerId}
        remoteService={importTarget}
        onClose={() => setImportTarget(null)}
        onImported={() => {
          setImportTarget(null);
          loadMapped();
        }}
      />

      <EditMappedModal
        mapped={editingMapped}
        onClose={() => setEditingMapped(null)}
        onSaved={() => {
          setEditingMapped(null);
          loadMapped();
        }}
      />

      <ConfirmDialog
        open={!!deletingMapped}
        onClose={() => setDeletingMapped(null)}
        onConfirm={handleDeleteMapped}
        loading={deleteLoading}
        title="حذف الخدمة المستوردة"
        description={`هل أنت متأكد من حذف "${deletingMapped?.name}"؟`}
        confirmLabel="حذف"
      />
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <div className="flex items-center">
      <StatusBadge active={active} />
    </div>
  );
}

function ImportModal({
  providerId,
  remoteService,
  onClose,
  onImported,
}: {
  providerId: string;
  remoteService: RemoteService | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const [costPrice, setCostPrice] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [maxQuantity, setMaxQuantity] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (remoteService) {
      setCostPrice(String(remoteService.rate));
      setMinQuantity(String(remoteService.min));
      setMaxQuantity(String(remoteService.max));
      setName(remoteService.name);
      setCategory(remoteService.category ?? "");
    }
  }, [remoteService]);

  if (!remoteService) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!remoteService) return;
    setSubmitting(true);
    try {
      await api.post(`/providers/${providerId}/mapped-services`, {
        externalServiceId: remoteService.externalServiceId,
        name: name.trim(),
        category: category.trim() || undefined,
        costPrice: Number(costPrice),
        minQuantity: Number(minQuantity),
        maxQuantity: Number(maxQuantity),
      });
      toast.success("تم استيراد الخدمة بنجاح");
      onImported();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={!!remoteService} onClose={onClose} title="استيراد خدمة">
      <form onSubmit={onSubmit}>
        <Field label="اسم الخدمة">
          <input
            className={inputClass}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="الفئة">
          <input
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </Field>
        <Field label="سعر التكلفة">
          <input
            type="number"
            step="0.0001"
            min="0"
            required
            className={inputClass}
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الحد الأدنى">
            <input
              type="number"
              min="1"
              required
              className={inputClass}
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
            />
          </Field>
          <Field label="الحد الأقصى">
            <input
              type="number"
              min="1"
              required
              className={inputClass}
              value={maxQuantity}
              onChange={(e) => setMaxQuantity(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={submitting}>
            استيراد
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditMappedModal({
  mapped,
  onClose,
  onSaved,
}: {
  mapped: ProviderService | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [maxQuantity, setMaxQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mapped) {
      setName(mapped.name);
      setCategory(mapped.category ?? "");
      setCostPrice(String(mapped.costPrice));
      setMinQuantity(String(mapped.minQuantity));
      setMaxQuantity(String(mapped.maxQuantity));
    }
  }, [mapped]);

  if (!mapped) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mapped) return;
    setSubmitting(true);
    try {
      await api.patch(`/provider-services/${mapped.id}`, {
        name: name.trim(),
        category: category.trim() || undefined,
        costPrice: Number(costPrice),
        minQuantity: Number(minQuantity),
        maxQuantity: Number(maxQuantity),
      });
      toast.success("تم تحديث الخدمة بنجاح");
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={!!mapped} onClose={onClose} title="تعديل خدمة مستوردة">
      <form onSubmit={onSubmit}>
        <Field label="اسم الخدمة">
          <input
            className={inputClass}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="الفئة">
          <input
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </Field>
        <Field label="سعر التكلفة">
          <input
            type="number"
            step="0.0001"
            min="0"
            required
            className={inputClass}
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الحد الأدنى">
            <input
              type="number"
              min="1"
              required
              className={inputClass}
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
            />
          </Field>
          <Field label="الحد الأقصى">
            <input
              type="number"
              min="1"
              required
              className={inputClass}
              value={maxQuantity}
              onChange={(e) => setMaxQuantity(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={submitting}>
            حفظ
          </Button>
        </div>
      </form>
    </Modal>
  );
}
