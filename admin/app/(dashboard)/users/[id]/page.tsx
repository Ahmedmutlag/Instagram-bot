"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AppUser, Order, Paginated } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { PageSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TableWrap, Table, Th, Td } from "@/components/Table";
import { Pagination } from "@/components/Pagination";
import { Badge, OrderStatusBadge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputClass } from "@/components/Field";

const LIMIT = 10;

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params.id;

  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orders, setOrders] = useState<Paginated<Order> | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [deductOpen, setDeductOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [banLoading, setBanLoading] = useState(false);

  const loadUser = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .get<AppUser>(`/users/${userId}`)
      .then(setUser)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    let active = true;
    setOrdersLoading(true);
    api
      .get<Paginated<Order>>(`/users/${userId}/orders`, { page, limit: LIMIT })
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch((err) => {
        if (active) toast.error(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, page]);

  async function handleBanToggle() {
    if (!user) return;
    setBanLoading(true);
    try {
      const updated = await api.post<AppUser>(
        `/users/${user.id}/${user.isBanned ? "unban" : "ban"}`
      );
      setUser(updated);
      toast.success(user.isBanned ? "تم إلغاء الحظر بنجاح" : "تم حظر المستخدم بنجاح");
      setBanOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBanLoading(false);
    }
  }

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "مستخدم";

  return (
    <div>
      <button
        onClick={() => router.push("/users")}
        className="mb-4 text-sm text-brand-600 hover:underline"
      >
        ← العودة إلى المستخدمين
      </button>

      {loading && <PageSpinner />}
      {!loading && error && (
        <EmptyState title="تعذر تحميل المستخدم" description={error} />
      )}

      {!loading && !error && user && (
        <>
          <PageHeader
            title={displayName}
            description={`معرف تيليجرام: ${user.telegramId}`}
            actions={
              <>
                <Button variant="secondary" onClick={() => setAddOpen(true)}>
                  إضافة رصيد
                </Button>
                <Button variant="secondary" onClick={() => setDeductOpen(true)}>
                  خصم رصيد
                </Button>
                <Button
                  variant={user.isBanned ? "primary" : "danger"}
                  onClick={() => setBanOpen(true)}
                >
                  {user.isBanned ? "إلغاء الحظر" : "حظر المستخدم"}
                </Button>
              </>
            }
          />

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">الرصيد الحالي</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {formatCurrency(user.balance)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">الحالة</p>
              <p className="mt-2">
                <Badge tone={user.isBanned ? "red" : "green"}>
                  {user.isBanned ? "محظور" : "نشط"}
                </Badge>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">تاريخ التسجيل</p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                {formatDate(user.createdAt)}
              </p>
            </div>
          </div>

          <h2 className="mb-3 text-base font-bold text-slate-800">طلبات المستخدم</h2>
          {ordersLoading && <PageSpinner />}
          {!ordersLoading && orders && orders.data.length === 0 && (
            <EmptyState title="لا توجد طلبات لهذا المستخدم" />
          )}
          {!ordersLoading && orders && orders.data.length > 0 && (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>رقم الطلب</Th>
                    <Th>الخدمة</Th>
                    <Th>الكمية</Th>
                    <Th>السعر</Th>
                    <Th>الحالة</Th>
                    <Th>التاريخ</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.data.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/orders?query=${order.orderNumber}`)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <Td>{order.orderNumber}</Td>
                      <Td>{order.service?.name ?? "—"}</Td>
                      <Td>{order.quantity}</Td>
                      <Td>{formatCurrency(order.price)}</Td>
                      <Td>
                        <OrderStatusBadge status={order.status} />
                      </Td>
                      <Td>{formatDate(order.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={page}
                limit={LIMIT}
                total={orders.meta.total}
                onPageChange={setPage}
              />
            </TableWrap>
          )}
        </>
      )}

      {user && (
        <BalanceModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          userId={user.id}
          mode="add"
          onSuccess={(updated) => {
            setUser(updated);
            setAddOpen(false);
          }}
        />
      )}
      {user && (
        <BalanceModal
          open={deductOpen}
          onClose={() => setDeductOpen(false)}
          userId={user.id}
          mode="deduct"
          onSuccess={(updated) => {
            setUser(updated);
            setDeductOpen(false);
          }}
        />
      )}
      {user && (
        <ConfirmDialog
          open={banOpen}
          onClose={() => setBanOpen(false)}
          onConfirm={handleBanToggle}
          loading={banLoading}
          title={user.isBanned ? "إلغاء حظر المستخدم" : "حظر المستخدم"}
          description={
            user.isBanned
              ? "سيتمكن المستخدم من استخدام البوت مرة أخرى."
              : "لن يتمكن المستخدم من استخدام البوت بعد الحظر."
          }
          confirmLabel={user.isBanned ? "إلغاء الحظر" : "حظر"}
          danger={!user.isBanned}
        />
      )}
    </div>
  );
}

function BalanceModal({
  open,
  onClose,
  userId,
  mode,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  mode: "add" | "deduct";
  onSuccess: (user: AppUser) => void;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setDescription("");
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح أكبر من صفر");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.post<{ user: AppUser } | AppUser>(
        `/users/${userId}/balance/${mode}`,
        { amount: numericAmount, description: description || undefined }
      );
      const updatedUser = (result as { user?: AppUser }).user ?? (result as AppUser);
      onSuccess(updatedUser);
      toast.success(mode === "add" ? "تمت إضافة الرصيد بنجاح" : "تم خصم الرصيد بنجاح");
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
      title={mode === "add" ? "إضافة رصيد" : "خصم رصيد"}
    >
      <form onSubmit={onSubmit}>
        <Field label="المبلغ">
          <input
            type="number"
            step="0.01"
            min="0"
            required
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="الوصف (اختياري)">
          <input
            type="text"
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="سبب العملية"
          />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={submitting}>
            {mode === "add" ? "إضافة" : "خصم"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
