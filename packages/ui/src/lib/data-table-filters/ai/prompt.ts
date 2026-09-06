import type { TableSchemaDefinition } from "@openstatus/ui/lib/data-table-filters/table-schema/index";

import {
  generateAIContext,
  type AIContext,
  type AIFieldContext,
} from "./context";

export type GenerateAIPromptOptions = {
  /** Current date/time for resolving relative time expressions like "last hour". */
  now?: Date;
};

function formatField(field: AIFieldContext): string {
  const parts: string[] = [];
  parts.push(`- **${field.key}** (label: "${field.label}")`);
  parts.push(`  Type: ${field.dataType}, Filter: ${field.filterType}`);

  if (field.description) {
    parts.push(`  Description: ${field.description}`);
  }
  if (field.allowedValues && field.allowedValues.length > 0) {
    parts.push(
      `  Allowed values: ${field.allowedValues.map((v) => `"${v}"`).join(", ")}`,
    );
  }
  if (field.min !== undefined || field.max !== undefined) {
    const bounds = [];
    if (field.min !== undefined) bounds.push(`min: ${field.min}`);
    if (field.max !== undefined) bounds.push(`max: ${field.max}`);
    parts.push(`  Range: ${bounds.join(", ")}`);
  }
  if (field.unit) {
    parts.push(`  Unit: ${field.unit}`);
  }

  return parts.join("\n");
}

function formatPrompt(
  context: AIContext,
  options?: GenerateAIPromptOptions,
): string {
  const lines: string[] = [];

  lines.push(
    "You are a filter assistant for a data table. Given a natural language query, " +
      "return a JSON object with the appropriate filter values. Only include fields " +
      "that the user's query references. If the query doesn't match any field, return " +
      "an empty object {}.",
  );

  lines.push("");
  lines.push("## Available filter fields");
  lines.push("");

  for (const field of context.fields) {
    lines.push(formatField(field));
    lines.push("");
  }

  lines.push("## Output rules");
  lines.push("");
  lines.push("- For **input** filters (text search): return a string value.");
  lines.push(
    "- For **checkbox** filters (multi-select): return an array of allowed values. Only use values from the allowed values list.",
  );
  lines.push(
    "- For **slider** filters (numeric range): return a [min, max] tuple within the field's bounds.",
  );
  lines.push(
    "- For **timerange** filters (date range): return a [start, end] tuple of ISO 8601 datetime strings.",
  );
  lines.push(
    "- Only include fields relevant to the query. Omit fields the user didn't mention or imply.",
  );
  lines.push("- Return valid JSON only. No explanations.");
  lines.push(
    '- The user message includes the current date/time. Use it to resolve relative time expressions like "last hour", "yesterday", "past 7 days".',
  );

  if (options?.now) {
    lines.push("");
    lines.push(`## Current date/time`);
    lines.push("");
    lines.push(`Now: ${options.now.toISOString()}`);
    lines.push(
      'Use this to resolve relative time expressions like "last hour", "yesterday", "past 7 days".',
    );
  }

  return lines.join("\n");
}

/**
 * Generates a ready-to-use system prompt string from a table schema.
 *
 * The prompt describes all filterable columns and the expected output format
 * for an LLM to translate natural language queries into structured filter state.
 *
 * @param schema - Table schema definition (from `createTableSchema().definition`)
 * @param options - Optional config. Pass `{ now: new Date() }` to enable relative time resolution.
 */
export function generateAIPrompt(
  schema: TableSchemaDefinition,
  options?: GenerateAIPromptOptions,
): string {
  const context = generateAIContext(schema);
  return formatPrompt(context, options);
}
