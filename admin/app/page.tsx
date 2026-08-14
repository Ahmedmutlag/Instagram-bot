"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PageSpinner } from "@/components/Spinner";

export default function RootPage() {
  const { admin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(admin ? "/dashboard" : "/login");
  }, [loading, admin, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <PageSpinner />
    </div>
  );
}
