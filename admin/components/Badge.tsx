import clsx from "clsx";

type BadgeTone = "gray" | "green" | "red" | "yellow" | "blue" | "purple";

const toneClasses: Record<BadgeTone, string> = {
  gray: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-rose-100 text-rose-700",
  yellow: "bg-amber-100 text-amber-700",
  blue: "bg-sky-100 text-sky-700",
  purple: "bg-violet-100 text-violet-700",
};

export function Badge({
  children,
  tone = "gray",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const ORDER_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "yellow",
  PROCESSING: "blue",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
  PARTIAL: "purple",
  CANCELED: "gray",
  FAILED: "red",
  REFUNDED: "purple",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "معلق",
  PROCESSING: "قيد المعالجة",
  IN_PROGRESS: "قيد التنفيذ",
  COMPLETED: "مكتمل",
  PARTIAL: "منجز جزئياً",
  CANCELED: "ملغى",
  FAILED: "فشل",
  REFUNDED: "مسترجع",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status] ?? "gray"}>
      {ORDER_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const PAYMENT_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "yellow",
  SUCCESS: "green",
  FAILED: "red",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "معلقة",
  SUCCESS: "ناجحة",
  FAILED: "فاشلة",
};

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={PAYMENT_STATUS_TONE[status] ?? "gray"}>
      {PAYMENT_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "green" : "gray"}>
      {active ? "مفعّل" : "موقف"}
    </Badge>
  );
}
