import {
  resolveColumn,
  type ResolvedColumn,
  type TableSchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";
import { z } from "zod";

/**
 * The values a checkbox column accepts, as strings. Mirrors the derivation in
 * `generateFilterFields` / `parseAIFilterValue`: without it an enum column that
 * never spelled out `options` would let the model return arbitrary strings that
 * are then dropped on validation.
 */
function checkboxValues(config: ResolvedColumn): string[] | null {
  const options = config.filter?.options;
  if (options && options.length > 0) return options.map((o) => String(o.value));
  if (config.kind === "enum" && config.enumValues.length > 0) {
    return [...config.enumValues];
  }
  if (
    config.kind === "array" &&
    config.arrayItem.kind === "enum" &&
    config.arrayItem.enumValues.length > 0
  ) {
    return [...config.arrayItem.enumValues];
  }
  if (config.kind === "boolean") return ["true", "false"];
  return null;
}

/**
 * Generates a Zod schema for LLM structured output from a table schema.
 *
 * Each filterable column becomes an optional field in the output schema:
 * - `input` (string) → `z.string().optional()`
 * - `input` (number) → `z.number().optional()`
 * - `checkbox` (enum) → `z.array(z.enum([...values])).optional()`
 * - `checkbox` (boolean) → `z.array(z.enum(["true", "false"])).optional()`
 * - `checkbox` (number) → `z.array(z.number()).optional()`
 * - `slider` → `z.tuple([z.number(), z.number()]).optional()`
 * - `timerange` → `z.tuple([z.string(), z.string()]).optional()`
 *
 * Command-disabled columns are intentionally included so the AI can infer
 * filters that aren't available in the command palette (e.g. date ranges).
 */
export function generateAIOutputSchema(schema: TableSchemaDefinition) {
  const shape: Record<string, z.ZodType> = {};

  for (const [key, builder] of Object.entries(schema)) {
    const config = resolveColumn(builder);
    if (!config.filter) continue;

    const filterType = config.filter.type;
    const desc = config.description || config.label || key;

    switch (filterType) {
      case "input": {
        if (config.kind === "number") {
          shape[key] = z.number().optional().describe(desc);
        } else {
          shape[key] = z.string().optional().describe(desc);
        }
        break;
      }

      case "checkbox": {
        const values = checkboxValues(config);
        if (values && values.length >= 2) {
          shape[key] = z
            .array(z.enum(values as [string, ...string[]]))
            .optional()
            .describe(desc);
        } else if (values && values.length === 1) {
          shape[key] = z.array(z.literal(values[0]!)).optional().describe(desc);
        } else if (config.kind === "number") {
          shape[key] = z.array(z.number()).optional().describe(desc);
        } else {
          shape[key] = z.array(z.string()).optional().describe(desc);
        }
        break;
      }

      case "slider": {
        const parts = [desc];
        if (
          config.filter.min !== undefined ||
          config.filter.max !== undefined
        ) {
          const bounds = [];
          if (config.filter.min !== undefined)
            bounds.push(`min: ${config.filter.min}`);
          if (config.filter.max !== undefined)
            bounds.push(`max: ${config.filter.max}`);
          parts.push(`Range: ${bounds.join(", ")}`);
        }
        if (config.filter.unit) parts.push(`Unit: ${config.filter.unit}`);

        shape[key] = z
          .tuple([z.number(), z.number()])
          .optional()
          .describe(parts.join(". "));
        break;
      }

      case "timerange": {
        shape[key] = z
          .tuple([z.string(), z.string()])
          .optional()
          .describe(desc + ". ISO 8601 datetime strings [start, end].");
        break;
      }
    }
  }

  return z.object(shape as z.core.$ZodLooseShape);
}
