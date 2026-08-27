import {
  resolveColumn,
  type TableSchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";

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

    const filterType = config.filter.type;

    switch (filterType) {
      case "input": {
        // Complete when non-null. Emit only if changed.
        if (nextVal !== prevVal) {
          completed.push({ key, value: nextVal });
        }
        break;
      }

      case "checkbox": {
        // Array — complete on first value, update as more arrive
        if (!Array.isArray(nextVal)) break;
        if (nextVal.length === 0) break;

        const prevArr = Array.isArray(prevVal) ? prevVal : [];
        if (
          nextVal.length !== prevArr.length ||
          nextVal.some((v, i) => v !== prevArr[i])
        ) {
          completed.push({ key, value: nextVal });
        }
        break;
      }

      case "slider": {
        // Tuple[2] — wait for both values
        if (!Array.isArray(nextVal)) break;
        if (nextVal.length < 2) break;
        if (typeof nextVal[0] !== "number" || typeof nextVal[1] !== "number")
          break;

        const prevArr = Array.isArray(prevVal) ? prevVal : [];
        if (nextVal[0] !== prevArr[0] || nextVal[1] !== prevArr[1]) {
          completed.push({ key, value: nextVal });
        }
        break;
      }

      case "timerange": {
        // Tuple[2] — wait for both date strings
        if (!Array.isArray(nextVal)) break;
        if (nextVal.length < 2) break;
        if (typeof nextVal[0] !== "string" || typeof nextVal[1] !== "string")
          break;

        const prevArr = Array.isArray(prevVal) ? prevVal : [];
        if (nextVal[0] !== prevArr[0] || nextVal[1] !== prevArr[1]) {
          completed.push({ key, value: nextVal });
        }
        break;
      }
    }
  }

  return completed;
}
