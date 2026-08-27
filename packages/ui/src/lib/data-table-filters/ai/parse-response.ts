import {
  resolveColumn,
  type TableSchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";

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
    const config = resolveColumn(builder);
    if (!config.filter) continue;

    const value = response[key];
    if (value === undefined || value === null) continue;

    const filterType = config.filter.type;

    switch (filterType) {
      case "input": {
        if (config.kind === "number") {
          if (typeof value === "number") {
            result[key] = value;
            hasFields = true;
          }
        } else {
          if (typeof value === "string" && value.length > 0) {
            result[key] = value;
            hasFields = true;
          }
        }
        break;
      }

      case "checkbox": {
        if (!Array.isArray(value)) break;
        if (value.length === 0) break;

        const options = config.filter.options;
        if (options && options.length > 0) {
          // Build a map from string representation to original typed value
          const optionMap = new Map(
            options.map((o) => [String(o.value), o.value]),
          );
          // Match AI strings against allowed values, coerce back to original type
          const valid = value
            .map(String)
            .filter((v) => optionMap.has(v))
            .map((v) => optionMap.get(v)!);
          if (valid.length > 0) {
            result[key] = valid;
            hasFields = true;
          }
        } else {
          result[key] = value;
          hasFields = true;
        }
        break;
      }

      case "slider": {
        if (!Array.isArray(value)) break;
        if (value.length < 2) break;

        let [min, max] = value as [number, number];
        if (typeof min !== "number" || typeof max !== "number") break;

        // Clamp to bounds
        if (config.filter.min !== undefined) {
          min = Math.max(min, config.filter.min);
        }
        if (config.filter.max !== undefined) {
          max = Math.min(max, config.filter.max);
        }

        if (min > max) break;

        result[key] = [min, max];
        hasFields = true;
        break;
      }

      case "timerange": {
        if (!Array.isArray(value)) break;
        if (value.length < 2) break;

        const [startStr, endStr] = value as [string, string];
        if (typeof startStr !== "string" || typeof endStr !== "string") break;

        const start = new Date(startStr);
        const end = new Date(endStr);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) break;
        if (start > end) break;

        result[key] = [start, end];
        hasFields = true;
        break;
      }
    }
  }

  return hasFields ? result : null;
}
