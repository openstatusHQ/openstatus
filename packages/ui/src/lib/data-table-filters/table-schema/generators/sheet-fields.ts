import type { SheetField } from "@openstatus/ui/components/data-table-filters/types";

import { resolveColumns } from "../col";
import type { TableSchemaDefinition } from "../types";

/**
 * Generate SheetField[] from a table schema definition.
 *
 * Only includes fields where sheet !== null (.sheet() was called).
 * Sheet type is derived from the filter type, or "readonly" if not filterable.
 * Sheet label falls back to the column label if not overridden in .sheet({ label }).
 */
export function generateSheetFields<TData>(
  schema: TableSchemaDefinition,
): SheetField<TData>[] {
  const result: SheetField<TData>[] = [];

  for (const config of resolveColumns(schema)) {
    const sheetConfig = config.sheet;
    if (sheetConfig === null) continue;

    // Derive sheet type from filter type, or "readonly" if not filterable
    const sheetType: SheetField<TData>["type"] =
      config.filter?.type ?? "readonly";

    result.push({
      id: config.key as keyof TData,
      label: sheetConfig.label ?? config.label,
      type: sheetType,
      // The descriptor's display is always a real serializable display, even
      // when a custom cell renderer was supplied — no per-kind fallback needed.
      display: config.display,
      component: config.renderers
        .sheetComponent as SheetField<TData>["component"],
      condition: config.renderers
        .sheetCondition as SheetField<TData>["condition"],
      className: sheetConfig.className,
      skeletonClassName: sheetConfig.skeletonClassName,
    });
  }

  return result;
}
