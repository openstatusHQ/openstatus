import {
  resolveColumn,
  type ResolvedColumn,
  type TableSchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";

export type ParsedFilterValue = { ok: true; value: unknown } | { ok: false };

const INVALID: ParsedFilterValue = { ok: false };

/**
 * Allowed checkbox values, keyed by their string form so an LLM string can be
 * coerced back to the typed value. Falls back to the column's own enum when the
 * filter carries no explicit options — the same derivation `generateFilterFields`
 * does, so what the AI may emit matches what the UI can render.
 */
function checkboxOptionMap(
  config: ResolvedColumn,
): Map<string, unknown> | null {
  const options = config.filter?.options;
  if (options && options.length > 0) {
    return new Map(options.map((o) => [String(o.value), o.value]));
  }
  if (config.kind === "enum" && config.enumValues.length > 0) {
    return new Map(config.enumValues.map((v) => [v, v]));
  }
  if (
    config.kind === "array" &&
    config.arrayItem.kind === "enum" &&
    config.arrayItem.enumValues.length > 0
  ) {
    return new Map(config.arrayItem.enumValues.map((v) => [v, v]));
  }
  if (config.kind === "boolean") {
    return new Map<string, unknown>([
      ["true", true],
      ["false", false],
    ]);
  }
  return null;
}

/**
 * Validates and coerces a single LLM-produced value for one column.
 *
 * The single source of truth for "is this filter value usable?" — used both by
 * the progressive stream path (`diffPartialState`) and the final reconciliation
 * (`parseAIResponse`), so a value can never be applied mid-stream and then be
 * rejected at the end.
 */
export function parseAIFilterValue(
  config: ResolvedColumn,
  value: unknown,
): ParsedFilterValue {
  if (!config.filter) return INVALID;
  if (value === undefined || value === null) return INVALID;

  switch (config.filter.type) {
    case "input": {
      if (config.kind === "number") {
        if (typeof value !== "number" || !Number.isFinite(value))
          return INVALID;
        return { ok: true, value };
      }
      if (typeof value !== "string" || value.length === 0) return INVALID;
      return { ok: true, value };
    }

    case "checkbox": {
      if (!Array.isArray(value)) return INVALID;
      if (value.length === 0) return INVALID;

      const optionMap = checkboxOptionMap(config);
      if (!optionMap) return { ok: true, value };

      const valid = value
        .map(String)
        .filter((v) => optionMap.has(v))
        .map((v) => optionMap.get(v));
      if (valid.length === 0) return INVALID;
      return { ok: true, value: valid };
    }

    case "slider": {
      if (!Array.isArray(value)) return INVALID;
      if (value.length < 2) return INVALID;

      let [min, max] = value as [number, number];
      if (typeof min !== "number" || typeof max !== "number") return INVALID;

      if (config.filter.min !== undefined)
        min = Math.max(min, config.filter.min);
      if (config.filter.max !== undefined)
        max = Math.min(max, config.filter.max);

      if (min > max) return INVALID;
      return { ok: true, value: [min, max] };
    }

    case "timerange": {
      if (!Array.isArray(value)) return INVALID;
      if (value.length < 2) return INVALID;

      const [startStr, endStr] = value as [string, string];
      if (typeof startStr !== "string" || typeof endStr !== "string") {
        return INVALID;
      }

      const start = new Date(startStr);
      const end = new Date(endStr);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) return INVALID;
      if (start > end) return INVALID;
      return { ok: true, value: [start, end] };
    }

    default: {
      return INVALID;
    }
  }
}

/**
 * Validates and coerces a complete LLM response into clean filter state.
 *
 * - Strips fields not in the schema or not filterable
 * - Converts ISO date strings to Date objects for timerange fields
 * - Validates checkbox values against allowed options
 * - Clamps slider values to min/max bounds
 * - Returns `null` if the response is empty (no valid filters)
 */
export function parseAIResponse(
  schema: TableSchemaDefinition,
  response: Record<string, unknown>,
): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  let hasFields = false;

  for (const [key, builder] of Object.entries(schema)) {
    const parsed = parseAIFilterValue(resolveColumn(builder), response[key]);
    if (!parsed.ok) continue;
    result[key] = parsed.value;
    hasFields = true;
  }

  return hasFields ? result : null;
}
