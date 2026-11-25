import type { FilterOp, Scalar } from "./types";

/**
 * Read a possibly dotted key off a row.
 *
 * Table schema keys are dot-notation (`"timing.dns"`). Rows may store that
 * either as a literal flat key or as a nested object, so both are tried —
 * a flat hit wins, since that is the wire shape.
 */
export function getValueAtKey(row: unknown, key: string): unknown {
  if (row === null || typeof row !== "object") return undefined;
  const flat = (row as Record<string, unknown>)[key];
  if (flat !== undefined) return flat;
  if (!key.includes(".")) return undefined;
  let current: unknown = row;
  for (const part of key.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function sameScalar(cell: unknown, value: Scalar): boolean {
  if (cell === value) return true;
  // The URL layer can only produce strings, so a number column filtered from a
  // link arrives as one. Compare by string as a last resort rather than by
  // coercing, which would make `0 == false` true.
  if (
    (typeof cell === "number" || typeof cell === "boolean") &&
    typeof value === "string"
  ) {
    return String(cell) === value;
  }
  if (typeof cell === "string" && typeof value !== "string") {
    return cell === String(value);
  }
  return false;
}

function asComparableNumber(cell: unknown): number | null {
  if (typeof cell === "number") return Number.isNaN(cell) ? null : cell;
  if (typeof cell === "string" && cell.trim() !== "") {
    const parsed = Number(cell);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function asComparableTime(cell: unknown): number | null {
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime()) ? null : cell.getTime();
  }
  if (typeof cell === "string" || typeof cell === "number") {
    const time = new Date(cell).getTime();
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

/**
 * Evaluate one canonical op against one cell value.
 *
 * Exhaustive over `FilterOp` with no default branch — a seventh op fails to
 * compile here rather than silently passing every row.
 */
export function evaluateOp(op: FilterOp, cell: unknown): boolean {
  switch (op.op) {
    case "substring": {
      if (cell === null || cell === undefined) return false;
      // Case-insensitive, matching the SQL side's `ilike`.
      return String(cell).toLowerCase().includes(op.value.toLowerCase());
    }

    case "equals":
      return sameScalar(cell, op.value);

    case "oneOf":
      return op.values.some((value) => sameScalar(cell, value));

    case "overlaps": {
      // The column is a set. A scalar cell is treated as a one-element set so
      // a single-value column still matches — this is where the infinite route
      // used to look only at `row[key][0]`.
      const cells = Array.isArray(cell) ? cell : [cell];
      return cells.some((item) =>
        op.values.some((value) => sameScalar(item, value)),
      );
    }

    case "numberRange": {
      const value = asComparableNumber(cell);
      return value !== null && value >= op.min && value <= op.max;
    }

    case "dateRange": {
      const time = asComparableTime(cell);
      return (
        time !== null && time >= op.from.getTime() && time <= op.to.getTime()
      );
    }
  }
}
