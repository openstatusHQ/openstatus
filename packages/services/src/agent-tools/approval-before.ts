import type { ApprovalBefore } from "./types";

/** Builds an `ApprovalBefore`, turning dates into ISO strings like the inputs. */
export function beforeSnapshot(
  label: string,
  current: Record<string, unknown>,
): ApprovalBefore {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(current)) {
    values[key] = value instanceof Date ? value.toISOString() : value;
  }
  return { label, values };
}
