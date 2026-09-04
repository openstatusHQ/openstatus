import { resolveColumns } from "../table-schema/col";
import type {
  ColumnDescriptor,
  SchemaJSON,
  TableSchemaDefinition,
} from "../table-schema/types";
import { evaluateOp, getValueAtKey } from "./evaluate";
import { isActive, normalize } from "./normalize";
import type { FilterOp, FilterSelection, FilterSpec, Scalar } from "./types";

export { evaluateOp, getValueAtKey } from "./evaluate";
export { isActive, normalize } from "./normalize";
export type {
  ColKind,
  FilterOp,
  FilterSelection,
  FilterSpec,
  FilterType,
  Scalar,
} from "./types";

/**
 * Where a `Filters` gets its declarations.
 *
 * `SchemaJSON` is here so the declaration can cross the `"use client"` boundary
 * as data: `table-schema.tsx` cannot be imported server-side, but its
 * `toJSON()` can.
 */
export type FilterSource =
  | TableSchemaDefinition
  | SchemaJSON
  | readonly FilterSpec[];

export interface Filters {
  readonly specs: readonly FilterSpec[];

  /** Look up one column's declaration. */
  spec(key: string): FilterSpec | undefined;

  /**
   * Values → canonical ops. Never guesses from the shape of a value.
   * Inactive and unknown keys are dropped.
   */
  plan(
    values: Record<string, unknown>,
    selection?: FilterSelection,
  ): FilterOp[];

  /** In-memory predicate. Replaces `filterData` and `filterGenericData`. */
  matches(
    values: Record<string, unknown>,
    row: unknown,
    selection?: FilterSelection,
  ): boolean;

  /** Filter a whole collection. */
  apply<TRow>(
    rows: readonly TRow[],
    values: Record<string, unknown>,
    selection?: FilterSelection,
  ): TRow[];

  /**
   * A TanStack `ColumnDef.filterFn`. Returns a *function*, so nothing has to be
   * registered on the table via `filterFns: { inDateRange, arrSome }`.
   */
  filterFn(
    key: string,
  ):
    | ((
        row: { getValue: (id: string) => unknown },
        columnId: string,
        value: unknown,
      ) => boolean)
    | undefined;

  /** Validate and coerce untrusted input (AI structured output, MCP args). */
  coerce(raw: Record<string, unknown>): Record<string, unknown>;
}

// ── Deriving specs ──────────────────────────────────────────────────────────

function specFromDescriptor(
  key: string,
  column: Pick<ColumnDescriptor, "kind" | "filter"> &
    Partial<Pick<Extract<ColumnDescriptor, { kind: "array" }>, "arrayItem">>,
): FilterSpec | null {
  const { filter } = column;
  if (!filter) return null;

  const spec: FilterSpec = {
    key,
    type: filter.type,
    kind: column.kind,
  };

  if (column.kind === "array" && column.arrayItem) {
    spec.itemKind = column.arrayItem.kind;
  }
  if (filter.options) {
    spec.options = filter.options.map((option) => option.value);
  }
  if (filter.min !== undefined) spec.min = filter.min;
  if (filter.max !== undefined) spec.max = filter.max;

  return spec;
}

function isSchemaJSON(source: FilterSource): source is SchemaJSON {
  return (
    !Array.isArray(source) &&
    typeof source === "object" &&
    source !== null &&
    Array.isArray((source as SchemaJSON).columns)
  );
}

function toSpecs(source: FilterSource): FilterSpec[] {
  if (Array.isArray(source)) {
    return [...(source as readonly FilterSpec[])];
  }

  if (isSchemaJSON(source)) {
    const specs: FilterSpec[] = [];
    for (const column of source.columns) {
      const spec = specFromDescriptor(column.key, column);
      if (spec) specs.push(spec);
    }
    return specs;
  }

  const specs: FilterSpec[] = [];
  for (const column of resolveColumns(source as TableSchemaDefinition)) {
    const spec = specFromDescriptor(column.key, column);
    if (spec) specs.push(spec);
  }
  return specs;
}

function isSelected(key: string, selection?: FilterSelection): boolean {
  if (selection?.exclude?.includes(key)) return false;
  if (selection?.only && !selection.only.includes(key)) return false;
  return true;
}

// ── Coercion ────────────────────────────────────────────────────────────────

function coerceValue(spec: FilterSpec, raw: unknown): unknown {
  // Round-tripping through `normalize` is the coercion: if the declared
  // semantics cannot make an op out of it, it is not a usable filter value.
  const op = normalize(spec, raw);
  if (!op) return undefined;

  switch (op.op) {
    case "substring":
      return op.value;
    case "equals":
      return op.value;
    case "oneOf":
    case "overlaps": {
      // Drop values outside the declared option set — an LLM will happily
      // invent an enum member that does not exist.
      if (!spec.options) return op.values;
      const allowed = op.values.filter((value) =>
        spec.options!.some((option) => String(option) === String(value)),
      );
      return allowed.length > 0 ? allowed : undefined;
    }
    case "numberRange": {
      // Clamp to the declared bounds. `coerce` is the untrusted-input entry
      // point, and an LLM asked for "slow requests" will happily produce
      // `[0, 99999]` against a slider declared `{ min: 0, max: 5000 }`.
      const lower = spec.min ?? -Infinity;
      const upper = spec.max ?? Infinity;
      const min = Math.min(Math.max(op.min, lower), upper);
      const max = Math.min(Math.max(op.max, lower), upper);
      return [min, max];
    }
    case "dateRange":
      return [op.from, op.to];
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Build the one interpretation of a table's filter semantics.
 *
 * Every engine — SQL, in-memory, TanStack — goes through this, so a column's
 * declared `(FilterType, ColKind)` pair is honoured identically everywhere
 * instead of being re-derived from whatever the value happened to look like at
 * runtime.
 */
export function defineFilters(source: FilterSource): Filters {
  const specs = toSpecs(source);
  const byKey = new Map(specs.map((spec) => [spec.key, spec]));

  const plan = (
    values: Record<string, unknown>,
    selection?: FilterSelection,
  ): FilterOp[] => {
    const ops: FilterOp[] = [];
    for (const [key, value] of Object.entries(values)) {
      if (!isSelected(key, selection)) continue;
      const spec = byKey.get(key);
      if (!spec) continue;
      const op = normalize(spec, value);
      if (op) ops.push(op);
    }
    return ops;
  };

  const matches = (
    values: Record<string, unknown>,
    row: unknown,
    selection?: FilterSelection,
  ): boolean =>
    plan(values, selection).every((op) =>
      evaluateOp(op, getValueAtKey(row, op.key)),
    );

  return {
    specs,

    spec: (key) => byKey.get(key),

    plan,

    matches,

    apply: (rows, values, selection) => {
      const ops = plan(values, selection);
      if (ops.length === 0) return [...rows];
      return rows.filter((row) =>
        ops.every((op) => evaluateOp(op, getValueAtKey(row, op.key))),
      );
    },

    filterFn: (key) => {
      const spec = byKey.get(key);
      if (!spec) return undefined;
      return (row, columnId, value) => {
        const op = normalize(spec, value);
        // An inactive filter matches everything, which is what TanStack expects
        // when a column filter is present but empty.
        if (!op) return true;
        return evaluateOp(op, row.getValue(columnId));
      };
    },

    coerce: (raw) => {
      const result: Record<string, unknown> = {};
      for (const spec of specs) {
        const value = raw[spec.key];
        if (!isActive(value)) continue;
        const coerced = coerceValue(spec, value);
        if (coerced !== undefined) result[spec.key] = coerced;
      }
      return result;
    },
  };
}

export type { Scalar as FilterScalar };
