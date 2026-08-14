export function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon?: string;
  tone?: "default" | "green" | "red" | "blue";
}) {
  const toneClasses: Record<string, string> = {
    default: "text-slate-800",
    green: "text-emerald-600",
    red: "text-rose-600",
    blue: "text-sky-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-bold ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}
