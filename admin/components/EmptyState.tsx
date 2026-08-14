export function EmptyState({
  title = "لا توجد بيانات",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
        {title}
      </p>
      {description && (
        <p className="max-w-sm text-sm text-slate-400">{description}</p>
      )}
      {action}
    </div>
  );
}
