"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/auth";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { DashboardStats } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { PageSpinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<DashboardStats>("/stats/dashboard")
      .then((data) => {
        if (active) setStats(data);
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
  }, []);

  return (
    <div>
      <PageHeader
        title="لوحة التحكم"
        description="نظرة عامة على أداء المنصة"
      />

      {loading && <PageSpinner />}

      {!loading && error && (
        <EmptyState title="تعذر تحميل الإحصائيات" description={error} />
      )}

      {!loading && !error && stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard
            label="إجمالي المستخدمين"
            value={formatNumber(stats.totalUsers)}
            icon="👥"
          />
          <StatCard
            label="إجمالي الطلبات"
            value={formatNumber(stats.totalOrders)}
            icon="📦"
          />
          <StatCard
            label="الطلبات المكتملة"
            value={formatNumber(stats.completedOrders)}
            icon="✅"
            tone="green"
          />
          <StatCard
            label="الطلبات المعلقة"
            value={formatNumber(stats.pendingOrders)}
            icon="⏳"
            tone="blue"
          />
          <StatCard
            label="إجمالي المبيعات"
            value={formatCurrency(stats.totalSales)}
            icon="💰"
          />
          <StatCard
            label="إجمالي تكلفة المزودين"
            value={formatCurrency(stats.totalCost)}
            icon="🧾"
          />
          <StatCard
            label="إجمالي الأرباح"
            value={formatCurrency(stats.totalProfit)}
            icon="📈"
            tone="green"
          />
        </div>
      )}
    </div>
  );
}
