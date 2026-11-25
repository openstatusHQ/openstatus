import {
  resolveColumn,
  type TableSchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";

export type AIFieldContext = {
  key: string;
  label: string;
  description?: string;
  dataType: string;
  filterType: string;
  allowedValues?: string[];
  min?: number;
  max?: number;
  unit?: string;
};

export type AIContext = {
  fields: AIFieldContext[];
};

/**
 * Extracts structured context from a table schema definition for use in LLM prompts.
 *
 * Returns metadata about each filterable column: field name, label, data type,
 * filter type, allowed values, bounds, and description. Non-filterable columns
 * are excluded. Command-disabled columns are intentionally included so the AI
 * can set filters (e.g. date ranges) that aren't available in the command palette.
 */
export function generateAIContext(schema: TableSchemaDefinition): AIContext {
  const fields: AIFieldContext[] = [];

  for (const [key, builder] of Object.entries(schema)) {
    const config = resolveColumn(builder);
    if (!config.filter) continue;

    const field: AIFieldContext = {
      key,
      label: config.label || key,
      dataType: config.kind,
      filterType: config.filter.type,
    };

    if (config.description) {
      field.description = config.description;
    }

    // Allowed values for checkbox filters (enums, booleans, arrays)
    if (config.filter.type === "checkbox" && config.filter.options) {
      field.allowedValues = config.filter.options.map((o) => String(o.value));
    } else if (config.kind === "enum" && config.enumValues) {
      field.allowedValues = [...config.enumValues];
    } else if (
      config.kind === "array" &&
      config.arrayItem?.kind === "enum" &&
      config.arrayItem.enumValues
    ) {
      field.allowedValues = [...config.arrayItem.enumValues];
    }

    // Bounds for slider filters
    if (config.filter.type === "slider") {
      if (config.filter.min !== undefined) field.min = config.filter.min;
      if (config.filter.max !== undefined) field.max = config.filter.max;
    }

    // Unit from filter or display config
    if (config.filter.unit) {
      field.unit = config.filter.unit;
    } else if (
      config.display.type === "number" &&
      "unit" in config.display &&
      config.display.unit
    ) {
      field.unit = config.display.unit;
    }

    fields.push(field);
  }

  return { fields };
}
