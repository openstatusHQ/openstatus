import type { ColKind, FilterOp, FilterSpec, Scalar } from "./types";

/** Unix ms timestamps are 13-digit numbers (> Sep 2001, < Nov 2286). */
const UNIX_MS_MIN = 1_000_000_000_000;

/**
 * Is this filter value active?
 *
 * Inactive means "the user has not filtered on this column": absent, cleared,
 * an empty multi-select, or a value that cannot be compared at all. This was
 * written four slightly different ways across four engines.
 */
export function isActive(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (Array.isArray(value)) {
    // ANY usable member makes the filter active. `normalize` drops the members
    // it cannot use, so requiring all of them to be usable would make one blank
    // entry silently delete the whole filter — and inconsistently, since
    // `["abc", 500]` on a slider degenerates to 500 while `["", 500]` vanished.
    return value.some(isActive);
  }
  return true;
}

/** Coerce to a `Date`, or `null` if it cannot be one. */
function asDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  // superjson revives Dates, but MCP args and LLM output arrive as ISO strings
  // or epoch millis.
  if (typeof value === "string" || typeof value === "number") {
    // Epoch millis that arrived as a string: `new Date("1700000000000")` is an
    // Invalid Date while `new Date(1700000000000)` is not. The command palette
    // serializes timeranges with `getTime()`, and JSON has no Date type, so
    // this shape is common. The magnitude test disambiguates it from a bare
    // year like "2024", which `Date` should keep parsing as a year.
    if (typeof value === "string" && /^\d+$/.test(value)) {
      const millis = Number(value);
      if (millis >= UNIX_MS_MIN) {
        const date = new Date(millis);
        return Number.isNaN(date.getTime()) ? null : date;
      }
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function asScalar(value: unknown): Scalar | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/**
 * Coerce one checkbox member to the column's declared type.
 *
 * The URL layer, MCP args, and LLM output all deliver `["200", "500"]` for a
 * numeric column. Without this, the SQL backend received
 * `inArray(integerColumn, ["200", "500"])` and depended on Postgres casting the
 * literals, and `coerce()` — the entry point documented as producing validated
 * values — handed back strings for a number column.
 */
function asDeclaredScalar(kind: ColKind, value: unknown): Scalar | null {
  switch (kind) {
    case "number":
      return asNumber(value);
    case "boolean":
      return asBoolean(value);
    default: {
      const scalar = asScalar(value);
      return scalar === null ? null : String(scalar);
    }
  }
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Turn one declared filter and its value into a canonical op.
 *
 * This is the whole design. Dispatch is on the **declared** `(type, kind)`
 * pair — never on the runtime shape of `value`. A numeric checkbox is
 * `{ type: "checkbox", kind: "number" }`, so `[200, 500]` can only become
 * `oneOf`; `numberRange` is unreachable from a checkbox and
 * `BETWEEN 200 AND 500` is therefore unrepresentable. Backends never see array
 * length, so length-based dispatch has nowhere to live.
 *
 * Returns `null` when the filter is inactive or the value cannot be coerced
 * into the declared shape.
 */
export function normalize(spec: FilterSpec, value: unknown): FilterOp | null {
  if (!isActive(value)) return null;
  const { key } = spec;

  switch (spec.type) {
    case "input": {
      // A number column's text box is an exact match, not a substring search —
      // substring matching on a stringified number makes "5" match 1500.
      if (spec.kind === "number") {
        const parsed = asNumber(Array.isArray(value) ? value[0] : value);
        return parsed === null ? null : { op: "equals", key, value: parsed };
      }
      const raw = Array.isArray(value) ? value[0] : value;
      const text = asScalar(raw);
      return text === null
        ? null
        : { op: "substring", key, value: String(text) };
    }

    case "checkbox": {
      // For an array column the members are compared against the *item* type.
      const memberKind =
        spec.kind === "array" ? (spec.itemKind ?? "string") : spec.kind;
      const values = asArray(value)
        .map((member) => asDeclaredScalar(memberKind, member))
        .filter((v): v is Scalar => v !== null);
      if (values.length === 0) return null;
      // An array column is a set on both sides — overlap, not membership.
      return spec.kind === "array"
        ? { op: "overlaps", key, values }
        : { op: "oneOf", key, values };
    }

    case "slider": {
      const numbers = asArray(value)
        .map(asNumber)
        .filter((v): v is number => v !== null);
      if (numbers.length === 0) return null;
      // A single-handle slider is a degenerate range, not an equality — the
      // two disagree once the column holds non-integers.
      const [first, second] = numbers;
      const min = first!;
      const max = second ?? first!;
      return {
        op: "numberRange",
        key,
        min: Math.min(min, max),
        max: Math.max(min, max),
      };
    }

    case "timerange": {
      const dates = asArray(value)
        .map(asDate)
        .filter((v): v is Date => v !== null);
      if (dates.length === 0) return null;
      // One date means "that whole day".
      if (dates.length === 1) {
        return {
          op: "dateRange",
          key,
          from: startOfDay(dates[0]!),
          to: endOfDay(dates[0]!),
        };
      }
      const [from, to] = dates;
      return from!.getTime() <= to!.getTime()
        ? { op: "dateRange", key, from: from!, to: to! }
        : { op: "dateRange", key, from: to!, to: from! };
    }
  }
}
