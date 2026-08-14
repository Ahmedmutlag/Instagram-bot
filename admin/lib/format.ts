const numberFormatter = new Intl.NumberFormat("ar", {
  maximumFractionDigits: 2,
});

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return numberFormatter.format(value);
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD"
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const formatted = new Intl.NumberFormat("ar", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${currency}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("ar", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return value;
  }
}
