"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";
import { useAuth } from "@/lib/auth";

export function Topbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { admin, logout } = useAuth();

  const currentLabel =
    NAV_ITEMS.find(
      (item) => pathname === item.href || pathname?.startsWith(`${item.href}/`)
    )?.label ?? "لوحة إدارة SMM";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="فتح القائمة"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        >
          <span className="text-xl">☰</span>
        </button>
        <span className="font-bold text-brand-700">{currentLabel}</span>
        <div className="w-9" />
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <span className="font-bold text-brand-700">لوحة إدارة SMM</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="إغلاق القائمة"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname?.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={clsx(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                          active
                            ? "bg-brand-50 text-brand-700"
                            : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span aria-hidden>{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="border-t border-slate-200 p-4">
              <p className="mb-2 truncate text-xs text-slate-400">
                {admin?.name} · {admin?.email}
              </p>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
              >
                <span aria-hidden>🚪</span>
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const BOTTOM_NAV_ITEMS = NAV_ITEMS.slice(0, 5);

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-slate-200 bg-white lg:hidden">
      {BOTTOM_NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              active ? "text-brand-700" : "text-slate-500"
            )}
          >
            <span className="text-lg" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
