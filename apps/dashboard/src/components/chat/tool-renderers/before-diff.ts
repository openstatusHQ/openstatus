import type { ApprovalBefore } from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

/**
 * One row per field the input sends. With `before`, a field whose value is
 * unchanged is dropped and the rest render as old → new; without it (the
 * load failed, or this is the result card) every sent field is after-only.
 */
export function fieldChanges<T extends object>(
  input: T,
  fields: readonly (keyof T & string)[],
  before?: ApprovalBefore,
): ChangeRow[] {
  const rows: ChangeRow[] = [];
  for (const field of fields) {
    const after = input[field];
    if (after === undefined) continue;
    if (before && field in before.values) {
      const previous = before.values[field];
      if (sameValue(previous, after, DATE_FIELDS.has(field))) continue;
      rows.push({ field, before: previous, after });
    } else {
      rows.push({ field, after });
    }
  }
  return rows;
}

/**
 * The entity id row, shown only without `before`: with it, the card header
 * names the entity instead.
 */
export function idRow(
  field: string,
  id: number,
  before?: ApprovalBefore,
): ChangeRow[] {
  return before ? [] : [{ field, after: id }];
}

/** Input fields that hold ISO datetimes, across the update tools. */
const DATE_FIELDS = new Set(["from", "to", "date", "startedAt"]);

// "" and null both mean "cleared"; id sets are order-insensitive; date
// fields compare by instant ("…:00Z" and "…:00.000Z" are the same). Free
// text never does, so an edited message that happens to look like a date
// still shows.
function normalize(value: unknown, isDate = false): unknown {
  if (value === undefined || value === null || value === "") return null;
  if (isDate && typeof value === "string") {
    const time = Date.parse(value);
    return Number.isNaN(time) ? value : new Date(time).toISOString();
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => JSON.stringify(normalize(v)))
      .sort()
      .join(",");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries.map(([k, v]) => [k, normalize(v)]));
  }
  return value;
}

export function sameValue(a: unknown, b: unknown, isDate = false): boolean {
  return (
    JSON.stringify(normalize(a, isDate)) ===
    JSON.stringify(normalize(b, isDate))
  );
}
