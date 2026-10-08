import {
  resolveColumn,
  type TableSchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";

/**
 * Determines if the user's input is a structured `key:value` filter query
 * or natural language that should be sent to an AI endpoint.
 *
 * Returns `true` if the input matches the structured query format (i.e.,
 * contains a known field name followed by `:`). Returns `false` for natural
 * language input.
 *
 * @param input - The raw user input from the command palette
 * @param schema - Table schema definition to derive known field names
 */
export function isStructuredQuery(
  input: string,
  schema: TableSchemaDefinition,
): boolean {
  const trimmed = input.trim();
  if (trimmed.length === 0) return false;

  // Collect known filterable field keys
  const fieldKeys = new Set<string>();
  for (const [key, builder] of Object.entries(schema)) {
    const config = resolveColumn(builder);
    if (config.filter && !config.filter.commandDisabled) {
      fieldKeys.add(key);
    }
  }

  // Check if any token in the input starts with `knownField:`
  // This handles both `regions:ams,gru` and `regions:ams latency:100-500`
  const tokens = trimmed.split(/\s+/);
  for (const token of tokens) {
    const colonIndex = token.indexOf(":");
    if (colonIndex > 0) {
      const field = token.substring(0, colonIndex);
      if (fieldKeys.has(field)) {
        return true;
      }
    }
  }

  return false;
}
