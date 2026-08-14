"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AppUser, Paginated } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { PageSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TableWrap, Table, Th, Td } from "@/components/Table";
import { Pagination } from "@/components/Pagination";
import { Badge } from "@/components/Badge";
import { inputClass } from "@/components/Field";

const LIMIT = 20;

export default function UsersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "BANNED">("ALL");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<AppUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, status]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<Paginated<AppUser>>("/users", {
        query: debouncedQuery,
        status: status === "ALL" ? undefined : status,
        page,
        limit: LIMIT,
      })
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, status, page]);

  return (
    <div>
      <PageHeader title="المستخدمون" description="إدارة مستخدمي البوت وأرصدتهم" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          className={`${inputClass} sm:max-w-xs`}
          placeholder="بحث بالاسم أو المعرف..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={`${inputClass} sm:max-w-[180px]`}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="ALL">كل الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="BANNED">محظور</option>
        </select>
      </div>

      {loading && <PageSpinner />}
      {!loading && error && (
        <EmptyState title="تعذر تحميل المستخدمين" description={error} />
      )}
      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState title="لا يوجد مستخدمون مطابقون" />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>المستخدم</Th>
                <Th>معرف تيليجرام</Th>
                <Th>الرصيد</Th>
                <Th>الحالة</Th>
                <Th>تاريخ التسجيل</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.data.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => router.push(`/users/${user.id}`)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <Td>
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                      user.username ||
                      "—"}
                    {user.username && (
                      <span className="ms-1 text-xs text-slate-400" dir="ltr">
                        @{user.username}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span dir="ltr">{user.telegramId}</span>
                  </Td>
                  <Td>{formatCurrency(user.balance)}</Td>
                  <Td>
                    <Badge tone={user.isBanned ? "red" : "green"}>
                      {user.isBanned ? "محظور" : "نشط"}
                    </Badge>
                  </Td>
                  <Td>{formatDate(user.createdAt)}</Td>
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
    </div>
  );
}
