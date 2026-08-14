import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789", 8);

/** Generates a human-readable, unique-enough order number, e.g. ORD-48213097. */
export function generateOrderNumber(): string {
  return `ORD-${nanoid()}`;
}
