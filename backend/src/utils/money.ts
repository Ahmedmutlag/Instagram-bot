import { Prisma } from "@prisma/client";

/** Converts a Prisma.Decimal (or any decimal-like value) to a plain JS number for API responses. */
export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toDecimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
