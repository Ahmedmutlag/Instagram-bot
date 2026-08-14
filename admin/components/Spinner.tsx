export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-e-transparent align-middle ${className}`}
      role="status"
      aria-label="جارٍ التحميل"
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex h-64 w-full items-center justify-center text-brand-600">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
