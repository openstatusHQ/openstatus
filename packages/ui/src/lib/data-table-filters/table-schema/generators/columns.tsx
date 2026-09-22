"use client";

import {
  DataTableCellBadge,
  DataTableCellBar,
  DataTableCellBoolean,
  DataTableCellCode,
  DataTableCellGauge,
  DataTableCellHeatmap,
  DataTableCellLevelIndicator,
  DataTableCellNumber,
  DataTableCellStar,
  DataTableCellStatusCode,
  DataTableCellText,
  DataTableCellTimestamp,
} from "@openstatus/ui/components/data-table-filters/data-table-cell/index";
import { DataTableColumnHeader } from "@openstatus/ui/components/data-table-filters/data-table-column-header";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  defineFilters,
  getValueAtKey,
} from "@openstatus/ui/lib/data-table-filters/filters/index";
import type { ColumnDef } from "@tanstack/react-table";
import type { JSX } from "react";

import { resolveColumns } from "../col";
import type { DisplayDescriptor, TableSchemaDefinition } from "../types";

/**
 * Render the cell based on the display config.
 */
function renderCell(
  display: DisplayDescriptor,
  value: unknown,
  context?: { min: number; max: number },
): JSX.Element | null {
  const fallback = <DataTableCellText value={String(value ?? "")} />;
  const colorMap = "colorMap" in display ? display.colorMap : undefined;
  switch (display.type) {
    case "text": {
      const hex = colorMap?.[String(value)];
      return typeof value === "string" || typeof value === "number" ? (
        <DataTableCellText value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "code": {
      const hex = colorMap?.[String(value)];
      return typeof value === "string" || typeof value === "number" ? (
        <DataTableCellCode value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "number": {
      const hex = colorMap?.[String(value)];
      return typeof value === "number" ? (
        <DataTableCellNumber value={value} unit={display.unit} color={hex} />
      ) : (
        fallback
      );
    }
    case "timestamp": {
      const hex = colorMap?.[String(value)];
      return value instanceof Date ||
        typeof value === "string" ||
        typeof value === "number" ? (
        <DataTableCellTimestamp date={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "badge": {
      if (Array.isArray(value)) {
        return (
          <div className="flex-no-wrap flex gap-1">
            {value.map((item, i) => (
              <DataTableCellBadge
                key={i}
                value={item}
                color={colorMap?.[String(item)]}
              />
            ))}
          </div>
        );
      }
      const hex = colorMap?.[String(value)];
      return typeof value === "string" || typeof value === "number" ? (
        <DataTableCellBadge value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "boolean": {
      const hex = colorMap?.[String(value)];
      return typeof value === "boolean" ? (
        <DataTableCellBoolean value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "star": {
      return typeof value === "boolean" ? (
        <DataTableCellStar value={value} />
      ) : (
        fallback
      );
    }
    case "status-code": {
      const hex = colorMap?.[String(value)];
      return typeof value === "number" ? (
        <DataTableCellStatusCode value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "level-indicator": {
      const hex = colorMap?.[String(value)];
      return typeof value === "string" ? (
        <DataTableCellLevelIndicator value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "heatmap": {
      const { min = 0, max = 100 } = context ?? {};
      return typeof value === "number" ? (
        <DataTableCellHeatmap
          value={value}
          min={min}
          max={max}
          unit={display.unit}
          color={display.color}
        />
      ) : (
        fallback
      );
    }
    case "bar": {
      const { min = 0, max = 100 } = context ?? {};
      return typeof value === "number" ? (
        <DataTableCellBar
          value={value}
          min={min}
          max={max}
          unit={display.unit}
          color={display.color}
        />
      ) : (
        fallback
      );
    }
    case "gauge": {
      const { min = 0, max = 100 } = context ?? {};
      return typeof value === "number" ? (
        <DataTableCellGauge
          value={value}
          min={min}
          max={max}
          unit={display.unit}
          color={display.color}
        />
      ) : (
        fallback
      );
    }
  }
}

/**
 * Generate ColumnDef[] from a table schema definition.
 *
 * Rules:
 * - Dotted keys (e.g. "timing.dns") → id + accessorFn
 * - Non-dotted keys → accessorKey
 * - Sortable columns get DataTableColumnHeader; others get a plain string header
 * - filterFn comes from the shared filter-semantics module
 * - Cell renders via built-in display components or the "custom" cell function
 * - meta.label is always set; meta.hidden reflects .hidden() calls
 *
 * Composite/virtual columns that span multiple fields must be appended manually:
 * @example
 * ```ts
 * const columns = [
 *   ...generateColumns(tableSchema),
 *   { id: "timing", header: ..., cell: ..., size: 130 },
 * ];
 * ```
 */
export function generateColumns<TData>(
  schema: TableSchemaDefinition,
): ColumnDef<TData>[] {
  // One interpretation of filter semantics, shared with the SQL and in-memory
  // engines. `filterFn` returns a *function*, so the consuming table no longer
  // has to register `filterFns: { inDateRange, arrSome }` — a contract that was
  // undocumented outside a comment and silently broke filtering when missed.
  const filters = defineFilters(schema);

  return resolveColumns(schema).map((config) => {
    const { key } = config;

    // Select column — checkbox header + cell
    if (config.kind === "select") {
      return {
        id: key,
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
              className="shadow-none"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="shadow-none"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        ...(config.size !== undefined
          ? { size: config.size, minSize: config.size, maxSize: config.size }
          : {}),
        meta: { label: config.label, kind: "select", hidden: config.hidden },
      } as ColumnDef<TData>;
    }

    const isDotted = key.includes(".");
    const filterFn = filters.filterFn(key);

    const header = config.hideHeader
      ? () => <span className="sr-only">{config.label}</span>
      : config.sortable
        ? ({
            column,
          }: {
            column: Parameters<typeof DataTableColumnHeader>[0]["column"];
          }) => <DataTableColumnHeader column={column} title={config.label} />
        : config.label;

    const needsMinMax =
      config.display.type === "heatmap" ||
      config.display.type === "bar" ||
      config.display.type === "gauge";

    const customCell = config.renderers.cell;

    const cell = ({
      getValue,
      row,
      column,
    }: {
      getValue: () => unknown;
      row: { original: TData };
      column: { getFacetedMinMaxValues?: () => [number, number] | undefined };
    }) => {
      // A custom renderer overrides the descriptor's display. The descriptor
      // still carries a real display type, which is what the sheet and
      // `toJSON()` fall back to.
      if (customCell) return customCell(getValue(), row.original);
      if (needsMinMax) {
        const display = config.display as {
          min?: number;
          max?: number;
        };
        const faceted = column.getFacetedMinMaxValues?.();
        const min = faceted?.[0] ?? display.min ?? 0;
        const max = faceted?.[1] ?? display.max ?? 100;
        return renderCell(config.display, getValue(), { min, max });
      }
      return renderCell(config.display, getValue());
    };

    const meta = {
      label: config.label,
      hidden: config.hidden,
      kind: config.kind,
    };

    const base = {
      header,
      cell,
      enableResizing: config.resizable,
      ...(config.enableHiding === false ? { enableHiding: false } : {}),
      ...(filterFn ? { filterFn } : {}),
      ...(config.size !== undefined
        ? {
            size: config.size,
            ...(config.resizable ? {} : { minSize: config.size }),
          }
        : {}),
      meta,
    };

    if (isDotted) {
      return {
        ...base,
        id: key,
        // Same reader as the filter engine: a flat `"timing.dns"` key wins,
        // a nested `{ timing: { dns } }` row is walked.
        accessorFn: (row: TData) => getValueAtKey(row, key),
      } as ColumnDef<TData>;
    }

    return {
      ...base,
      accessorKey: key,
    } as ColumnDef<TData>;
  });
}
