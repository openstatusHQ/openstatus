import {
  resolveColumn,
  type TableSchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";

import { parseAIFilterValue } from "./parse-response";

export type CompletedField = {
  key: string;
  value: unknown;
};

/**
 * Compares two partial objects from an LLM stream and returns newly completed fields.
 *
 * Uses type-aware completeness rules based on the table schema's filter type:
 * - `input` (string/number): complete when non-null and non-undefined
 * - `checkbox` (array): complete on first value, updates as more arrive
 * - `slider` (tuple[2]): complete only when both values are present
 * - `timerange` (tuple[2]): complete only when both values are present
 *
 * Completed values go through `parseAIFilterValue` before they are emitted, so a
 * progressive update can never apply a value the final reconciliation would
 * reject (an unknown checkbox option, a reversed slider, an unparseable date).
 * The returned value is the coerced one — Date objects for timeranges, clamped
 * bounds for sliders — not the raw stream value.
 *
 * @param prev - Previous partial state from the stream (or `{}` for first chunk)
 * @param next - Current partial state from the stream
 * @param schema - Table schema definition for type-aware completeness checks
 * @returns Array of newly completed or updated fields ready for `adapter.setField()`
 */
export function diffPartialState(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  schema: TableSchemaDefinition,
): CompletedField[] {
  const completed: CompletedField[] = [];

  for (const [key, builder] of Object.entries(schema)) {
    const config = resolveColumn(builder);
    if (!config.filter) continue;

    const nextVal = next[key];
    const prevVal = prev[key];

    // Skip if the field hasn't appeared yet
    if (nextVal === undefined || nextVal === null) continue;

    let changed = false;

    switch (config.filter.type) {
      case "input": {
        // Complete when non-null. Emit only if changed.
        changed = nextVal !== prevVal;
        break;
      }

      case "checkbox": {
        // Array — complete on first value, update as more arrive
        if (!Array.isArray(nextVal)) break;
        if (nextVal.length === 0) break;

        const prevArr = Array.isArray(prevVal) ? prevVal : [];
        changed =
          nextVal.length !== prevArr.length ||
          nextVal.some((v, i) => v !== prevArr[i]);
        break;
      }

      case "slider": {
        // Tuple[2] — wait for both values
        if (!Array.isArray(nextVal)) break;
        if (nextVal.length < 2) break;
        if (typeof nextVal[0] !== "number" || typeof nextVal[1] !== "number")
          break;

        const prevArr = Array.isArray(prevVal) ? prevVal : [];
        changed = nextVal[0] !== prevArr[0] || nextVal[1] !== prevArr[1];
        break;
      }

      case "timerange": {
        // Tuple[2] — wait for both date strings
        if (!Array.isArray(nextVal)) break;
        if (nextVal.length < 2) break;
        if (typeof nextVal[0] !== "string" || typeof nextVal[1] !== "string")
          break;

        const prevArr = Array.isArray(prevVal) ? prevVal : [];
        changed = nextVal[0] !== prevArr[0] || nextVal[1] !== prevArr[1];
        break;
      }
    }

    if (!changed) continue;

    const parsed = parseAIFilterValue(config, nextVal);
    if (parsed.ok) completed.push({ key, value: parsed.value });
  }

  return completed;
}
