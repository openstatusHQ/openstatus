import type { DataTableFilterField } from "@openstatus/ui/components/data-table-filters/types";

import { fromPresetDescriptor, resolveColumns } from "../col";
import type { TableSchemaDefinition } from "../types";

/**
 * Generate DataTableFilterField[] from a table schema definition.
 *
 * Only includes fields where filter !== null.
 * Order follows schema definition order (JS object key insertion order).
 *
 * Options for checkbox fields are auto-derived from col.enum(values) or
 * col.boolean() if not explicitly provided via filterable("checkbox", { options }).
 */
export function generateFilterFields<TData>(
  schema: TableSchemaDefinition,
): DataTableFilterField<TData>[] {
  const result: DataTableFilterField<TData>[] = [];

  for (const config of resolveColumns(schema)) {
    const { key, filter, label, kind } = config;
    if (!filter) continue;

    const base = {
      label,
      value: key as keyof TData,
      defaultOpen: filter.defaultOpen || undefined,
      commandDisabled: filter.commandDisabled || undefined,
    };

    switch (filter.type) {
      case "input": {
        result.push({ ...base, type: "input" });
        break;
      }
      case "timerange": {
        result.push({
          ...base,
          type: "timerange",
          presets: filter.presets?.map(fromPresetDescriptor),
        });
        break;
      }
      case "checkbox": {
        // Derive options if not explicitly provided
        let options = filter.options;
        if (!options) {
          if (config.kind === "enum") {
            options = config.enumValues.map((v) => ({ label: v, value: v }));
          } else if (kind === "boolean") {
            options = [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ];
          } else if (
            config.kind === "array" &&
            config.arrayItem.kind === "enum"
          ) {
            options = config.arrayItem.enumValues.map((v) => ({
              label: v,
              value: v,
            }));
          }
        }
        result.push({
          ...base,
          type: "checkbox",
          options,
          keepEmptyOptions: filter.keepEmptyOptions || undefined,
          component: config.renderers.filterComponent,
        });
        break;
      }
      case "slider": {
        const displayUnit =
          "unit" in config.display ? config.display.unit : undefined;
        result.push({
          ...base,
          type: "slider",
          min: filter.min ?? 0,
          max: filter.max ?? 100,
          unit: filter.unit ?? displayUnit,
        });
        break;
      }
    }
  }

  return result;
}
