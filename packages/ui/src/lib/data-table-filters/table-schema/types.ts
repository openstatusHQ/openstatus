import type {
  DatePreset,
  Option,
} from "@openstatus/ui/components/data-table-filters/types";
import type { JSX } from "react";

export type ColKind =
  | "string"
  | "number"
  | "boolean"
  | "timestamp"
  | "enum"
  | "array"
  | "record"
  | "select";

/** The set of filter UI types. Used as the `F` generic on `ColBuilder<T, F>`. */
export type FilterType = "input" | "checkbox" | "slider" | "timerange";

export type DisplayConfig =
  | { type: "text"; colorMap?: Record<string, string> }
  | { type: "code"; colorMap?: Record<string, string> }
  | { type: "boolean"; colorMap?: Record<string, string> }
  | { type: "star"; colorMap?: Record<string, string> }
  | { type: "badge"; colorMap?: Record<string, string> }
  | { type: "timestamp"; colorMap?: Record<string, string> }
  | { type: "number"; unit?: string; colorMap?: Record<string, string> }
  | {
      type: "bar";
      min?: number;
      max?: number;
      unit?: string;
      color?: string;
      colorMap?: Record<string, string>;
    }
  | {
      type: "heatmap";
      min?: number;
      max?: number;
      unit?: string;
      color?: string;
      colorMap?: Record<string, string>;
    }
  | {
      type: "gauge";
      min?: number;
      max?: number;
      unit?: string;
      color?: string;
      colorMap?: Record<string, string>;
    }
  | { type: "status-code"; colorMap?: Record<string, string> }
  | { type: "level-indicator"; colorMap?: Record<string, string> }
  | {
      type: "custom";
      cell: (value: unknown, row: unknown) => JSX.Element | null;
      colorMap?: Record<string, string>;
    };

export type SheetConfig = {
  label?: string;
  component?: (row: unknown) => JSX.Element | null | string;
  condition?: (row: unknown) => boolean;
  className?: string;
  skeletonClassName?: string;
};

/**
 * A fluent builder for a single table column.
 *
 * `T` — TypeScript type of the column's data value (inferred by `InferTableType`).
 * `F` — union of filter UI types valid for this col kind (compile-time constraint):
 *
 * | Factory            | Allowed filter types                    |
 * |--------------------|-----------------------------------------|
 * | `col.string()`     | `"input"`                               |
 * | `col.number()`     | `"input" \| "slider" \| "checkbox"`     |
 * | `col.boolean()`    | `"checkbox"`                            |
 * | `col.timestamp()`  | `"timerange"`                           |
 * | `col.enum()`       | `"checkbox"`                            |
 * | `col.array()`      | `"checkbox"`                            |
 * | `col.record()`     | `never` — `filterable()` is an error    |
 *
 * Calling `filterable(type)` with a type not in `F` is a **compile-time error**.
 */
export interface ColBuilder<T, F extends FilterType = FilterType> {
  /**
   * @internal The serializable half of the column. Read it through
   * {@link resolveColumn} / {@link resolveColumns} rather than directly.
   */
  readonly _descriptor: ColumnDescriptor;

  /**
   * @internal The non-serializable half — the closures. Disjoint from
   * `_descriptor`: the two share no property name.
   */
  readonly _renderers: ColRenderers;

  /**
   * Sets the column header label shown in the table and filter sidebar.
   *
   * @example
   * col.string().label("Host")
   * col.enum(LEVELS).label("Severity")
   */
  label(text: string): ColBuilder<T, F>;

  /**
   * Attaches a human-readable description of the column's domain meaning.
   *
   * Not shown in the UI. Used by AI agents and MCP tools (via `toJSON()`) to
   * understand what the column represents.
   *
   * @example
   * col.number().label("Latency").description("Round-trip time from request to response, in ms")
   * col.enum(LEVELS).label("Level").description("Log severity: error > warn > info > debug")
   */
  description(text: string): ColBuilder<T, F>;

  /**
   * Sets how the column value is rendered in table cells.
   *
   * Built-in display types:
   * - `"text"` — plain text, truncated with tooltip on overflow
   * - `"code"` — monospace font (IDs, hashes, paths, hostnames)
   * - `"boolean"` — checkmark / dash icon
   * - `"badge"` — colored chip (enums, categories, tags)
   * - `"timestamp"` — relative time ("3m ago"), absolute datetime on hover
   * - `"number"` — formatted number with optional `unit` suffix
   * - `"bar"` — horizontal bar with `min`/`max` range and optional `unit`
   * - `"heatmap"` — background color intensity based on `min`/`max` range
   * - `"custom"` — developer-supplied JSX renderer (not serializable)
   *
   * @example
   * col.string().display("code")
   * col.number().display("number", { unit: "ms" })
   * col.number().display("bar", { min: 0, max: 5000, unit: "ms" })
   * col.number().display("heatmap", { min: 0, max: 100 })
   * col.enum(LEVELS).display("custom", { cell: (value) => <LevelBadge value={value} /> })
   */
  display(
    type:
      | "text"
      | "code"
      | "boolean"
      | "star"
      | "badge"
      | "timestamp"
      | "status-code"
      | "level-indicator",
    options?: { colorMap?: Record<string, string> },
  ): ColBuilder<T, F>;
  display(
    type: "number",
    options?: { unit?: string; colorMap?: Record<string, string> },
  ): ColBuilder<T, F>;
  display(
    type: "bar",
    options: {
      min: number;
      max: number;
      unit?: string;
      colorMap?: Record<string, string>;
    },
  ): ColBuilder<T, F>;
  display(
    type: "heatmap",
    options: {
      min: number;
      max: number;
      color?: string;
      colorMap?: Record<string, string>;
    },
  ): ColBuilder<T, F>;
  display(
    type: "custom",
    options: {
      cell: (value: unknown, row: unknown) => JSX.Element | null;
      colorMap?: Record<string, string>;
    },
  ): ColBuilder<T, F>;
  display(
    type: "heatmap" | "bar" | "gauge",
    options?: {
      min?: number;
      max?: number;
      unit?: string;
      color?: string;
    },
  ): ColBuilder<T, F>;

  /**
   * Enables filtering for this column using its default filter type.
   *
   * For `col.record()` (`F = never`) this is a **compile-time error**.
   * Use `.notFilterable()` on record columns instead (it is already the default).
   */
  filterable(...args: [F] extends [never] ? [never] : []): ColBuilder<T, F>;

  /**
   * Enables filtering with an explicit filter type and optional configuration.
   *
   * Only types in `F` are accepted — passing an invalid type is a **compile-time error**:
   * - `"input"` — free-text or number search field
   * - `"timerange"` — date range picker (with optional `presets`)
   * - `"checkbox"` — multi-select from a list of `options`
   * - `"slider"` — numeric range with required `min` / `max` bounds
   *
   * @example
   * col.string().filterable("input")
   * col.timestamp().filterable("timerange")
   * col.enum(LEVELS).filterable("checkbox", { options: LEVELS.map(v => ({ label: v, value: v })) })
   * col.number().filterable("slider", { min: 0, max: 5000 })
   */
  filterable(type: F & "input"): ColBuilder<T, "input">;
  filterable(
    type: F & "timerange",
    options?: { presets?: DatePreset[] },
  ): ColBuilder<T, "timerange">;
  filterable(
    type: F & "checkbox",
    options?: {
      options?: Option[];
      component?: (props: Option) => JSX.Element | null;
      /**
       * Offer every declared option even when the facets report no rows for it,
       * showing a count of `0`. Off by default: a column whose declared set is
       * far wider than what the data holds (regions, status codes) is better
       * pruned to what exists. Turn it on for a small closed set where a missing
       * option reads as a broken filter rather than an absent value.
       */
      keepEmptyOptions?: boolean;
    },
  ): ColBuilder<T, "checkbox">;
  filterable(
    type: F & "slider",
    options: { min: number; max: number; unit?: string },
  ): ColBuilder<T, "slider">;

  /**
   * Removes filtering from this column.
   *
   * After calling `.notFilterable()`, subsequent `.filterable()` calls are
   * **compile-time errors** (`F` becomes `never`).
   *
   * @example
   * col.string().label("Request ID").notFilterable().hidden()
   */
  notFilterable(): ColBuilder<T, never>;

  /**
   * Opens the filter accordion for this column by default in the filter sidebar.
   *
   * Only applies to filterable columns. Use for high-priority filters that
   * users should see immediately without expanding the sidebar manually.
   *
   * @example
   * col.enum(LEVELS).label("Level").filterable("checkbox").defaultOpen()
   */
  defaultOpen(): ColBuilder<T, F>;

  /**
   * Excludes this column from the command palette filter search.
   *
   * Useful for columns whose filter state is managed elsewhere (e.g. a date
   * picker in the toolbar) or for UI-only state fields like `cursor`.
   *
   * @example
   * col.timestamp().label("Date").filterable("timerange").commandDisabled()
   */
  commandDisabled(): ColBuilder<T, F>;

  /**
   * Hides the column by default (not shown on first render).
   *
   * Hidden columns appear in the column visibility menu and can be toggled on.
   * Use `getDefaultColumnVisibility(schema)` to derive the initial visibility map.
   *
   * @example
   * col.number().label("DNS").filterable("slider", { min: 0, max: 5000 }).hidden()
   */
  hidden(): ColBuilder<T, F>;

  /**
   * Hides the column header label in the table while keeping the column visible.
   *
   * The label is still used in the filter sidebar and other UI elements.
   *
   * @example
   * col.enum(LEVELS).label("Level").hideHeader()
   */
  hideHeader(): ColBuilder<T, F>;

  /**
   * Enables column resizing via a drag handle in the header.
   *
   * Without this, `size` locks the column to a fixed width (`minSize === size`).
   * With this, the column can be freely resized; `size` becomes the initial width only.
   *
   * @example
   * col.string().label("Host").size(125).resizable()
   */
  resizable(): ColBuilder<T, F>;

  /**
   * Sets a fixed column width in pixels.
   *
   * Without `.resizable()`, both `size` and `minSize` are set to this value.
   * With `.resizable()`, only `size` is set (initial width), allowing free resizing.
   *
   * @example
   * col.enum(LEVELS).label("Level").size(27)
   * col.timestamp().label("Date").size(200)
   */
  size(px: number): ColBuilder<T, F>;

  /**
   * Enables click-to-sort on the column header.
   *
   * Renders a `DataTableColumnHeader` with ascending/descending/none sort controls.
   *
   * @example
   * col.timestamp().label("Date").sortable()
   * col.number().label("Latency").filterable("slider", { min: 0, max: 5000 }).sortable()
   */
  sortable(): ColBuilder<T, F>;

  /**
   * Marks the data field as potentially `undefined` in the row type.
   *
   * Changes `T` to `T | undefined` in the inferred schema type (`InferTableType`).
   * Use when the column field may be absent from some rows.
   *
   * @example
   * col.number().optional().label("Percentile").notFilterable().hidden()
   * col.string().optional().label("Message").notFilterable()
   */
  optional(): ColBuilder<T | undefined, F>;

  /**
   * Includes this column in the row detail drawer (`DataTableSheet`).
   *
   * Pass a `SheetConfig` to customize label, renderer, visibility condition,
   * and layout class. Calling `.sheet()` with no arguments uses defaults
   * (label from `.label()`, no custom renderer).
   *
   * @example
   * col.timestamp().label("Date").sheet()
   * col.string().label("Host").sheet({ skeletonClassName: "w-24" })
   * col.number().label("Latency").sheet({
   *   component: (row) => <>{row.latency}ms</>,
   *   skeletonClassName: "w-16",
   * })
   */
  sheet(config?: SheetConfig): ColBuilder<T, F>;

  /**
   * Marks the column as sheet-only: hidden, not filterable, and excluded
   * from the column visibility dropdown (`enableHiding: false`).
   *
   * Convenience for `.hidden().notFilterable()` + `enableHiding: false`.
   *
   * @example
   * col.record().label("Headers").sheetOnly().sheet({ ... })
   * col.string().optional().label("Message").sheetOnly().sheet({ ... })
   */
  sheetOnly(): ColBuilder<T, never>;
}

export type TableSchemaDefinition = Record<string, ColBuilder<unknown, any>>;

// Infer the data row type from a table schema definition
export type InferTableType<T extends TableSchemaDefinition> = {
  [K in keyof T]: T[K] extends ColBuilder<infer U, any> ? U : never;
};

// ── Serializable descriptors (function-free) ────────────────────────────────
//
// `ColumnDescriptor` is TOTAL: no serializable property of a column may live
// outside it. `ColRenderers` holds everything that cannot survive JSON. The two
// are disjoint — they share no property name — and that disjointness is
// asserted at compile time in `descriptor-laws.test-d.ts`.

/** A JSON value. Used for `Provenance.args`. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Serializable display config — excludes the `custom` variant (contains JSX). */
export type SerializableDisplayConfig = Exclude<
  DisplayConfig,
  { type: "custom" }
>;

/** Alias kept for symmetry with the other `*Descriptor` names. */
export type DisplayDescriptor = SerializableDisplayConfig;

/** A checkbox option, stripped to its serializable fields. */
export type OptionDescriptor = {
  label: string;
  value: string | number | boolean;
};

/**
 * A timerange preset with its bounds as ISO 8601 instants.
 *
 * Known residual loss: presets are usually *relative* ("last hour") and computed
 * at construction, so a schema saved on Monday and loaded on Friday round-trips
 * byte-exactly but yields a stale range. A relative descriptor
 * (`{ duration: "PT1H" }`) is the correct long-term model; the point of storing
 * them here is that the loss stops being silent.
 */
export type DatePresetDescriptor = {
  label: string;
  shortcut: string;
  /** ISO 8601 instant. */
  from: string;
  /** ISO 8601 instant. */
  to: string;
};

export type FilterDescriptor = {
  type: FilterType;
  defaultOpen: boolean;
  commandDisabled: boolean;
  options?: OptionDescriptor[];
  keepEmptyOptions?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  presets?: DatePresetDescriptor[];
};

export type SheetDescriptor = {
  label?: string;
  className?: string;
  skeletonClassName?: string;
};

/**
 * How the column came to be. Recorded at construction so `schemaToTypeScript`
 * can read it instead of reverse-engineering the shape of the descriptor.
 */
export type Provenance =
  | { source: "manual" }
  | { source: "preset"; preset: string; args: readonly JsonValue[] }
  | { source: "inferred"; rule: string };

export type ColumnDescriptorCommon = {
  label: string;
  description?: string;
  optional: boolean;
  display: DisplayDescriptor;
  size?: number;
  hidden: boolean;
  enableHiding: boolean;
  hideHeader: boolean;
  resizable: boolean;
  sortable: boolean;
  filter: FilterDescriptor | null;
  sheet: SheetDescriptor | null;
  provenance: Provenance;
};

/**
 * Everything about a column that survives JSON.
 *
 * `arrayItem` and `enumValues` are **required** on their respective kinds — an
 * `array` column can no longer exist without a described item type, which is
 * what stopped `string[]` columns from silently degrading to `string`.
 */
export type ColumnDescriptor = ColumnDescriptorCommon &
  (
    | { kind: "array"; arrayItem: ColumnDescriptor }
    | { kind: "enum"; enumValues: readonly string[] }
    | { kind: Exclude<ColKind, "array" | "enum"> }
  );

/** Everything that CANNOT survive JSON. Disjoint from `ColumnDescriptor`. */
export type ColRenderers = {
  cell?: (value: unknown, row: unknown) => JSX.Element | null;
  filterComponent?: (props: Option) => JSX.Element | null;
  sheetComponent?: (row: unknown) => JSX.Element | null | string;
  sheetCondition?: (row: unknown) => boolean;
};

/** The public read model: one column's complete state, both halves. */
export type ResolvedColumn = ColumnDescriptor & {
  readonly renderers: ColRenderers;
};

/** `ResolvedColumn` plus the key it is registered under in the definition. */
export type ResolvedColumnEntry = ResolvedColumn & { readonly key: string };

/**
 * The current `SchemaJSON` version. Bump when the descriptor shape changes and
 * add a step to `migrateSchemaJSON`. The runtime constant lives in
 * `serialize.ts` — this module stays type-only so it can keep shipping in the
 * `data-table` block.
 */
export type SchemaJSONVersion = 1;

export type SchemaJSON = {
  version: SchemaJSONVersion;
  columns: Array<ColumnDescriptor & { key: string }>;
};
