import type {
  DatePreset,
  Option,
} from "@openstatus/ui/components/data-table-filters/types";

import type {
  ColBuilder,
  ColKind,
  ColRenderers,
  ColumnDescriptor,
  ColumnDescriptorCommon,
  DatePresetDescriptor,
  DisplayDescriptor,
  FilterDescriptor,
  FilterType,
  OptionDescriptor,
  Provenance,
  ResolvedColumn,
  ResolvedColumnEntry,
  SheetConfig,
  TableSchemaDefinition,
} from "./types";

// ── Per-kind defaults — the ONE definition ──────────────────────────────────

/**
 * The default cell display for a column kind.
 *
 * This is the single definition. `infer.ts`, `generators/sheet-fields.ts`, and
 * `serialize.ts` each used to carry their own copy, and the third disagreed
 * with the other two.
 */
export function defaultDisplayForKind(kind: ColKind): DisplayDescriptor {
  switch (kind) {
    case "number":
      return { type: "number" };
    case "boolean":
    case "select":
      return { type: "boolean" };
    case "timestamp":
      return { type: "timestamp" };
    case "enum":
    case "array":
      return { type: "badge" };
    case "string":
    case "record":
      return { type: "text" };
  }
}

const MANUAL: Provenance = { source: "manual" };

/**
 * Drop keys whose value is `undefined`.
 *
 * Descriptors have to be canonical: `JSON.stringify` erases an explicit
 * `undefined`, so a descriptor carrying one compares unequal to its own round
 * trip under `toStrictEqual` and under any key-based comparison, while looking
 * identical through `JSON`. `display("number", { unit: undefined })` — which
 * `col.presets.duration()` produces whenever no unit is given — is the case
 * that actually occurs.
 *
 * Exported for `infer.ts`, which builds descriptors outside the builder and so
 * has to hold the same invariant.
 */
export function compact<T extends Record<string, unknown>>(object: T): T {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
}

/**
 * Strip caller-supplied `Option`s down to their serializable fields.
 *
 * `Option.value` is `string | boolean | number | undefined`, but an option with
 * no value cannot be selected, cannot be encoded into filter state, and would
 * vanish from the descriptor on `JSON.stringify` — so it is dropped here,
 * at construction, rather than disappearing later at serialization time.
 */
function toOptionDescriptors(options: readonly Option[]): OptionDescriptor[] {
  const result: OptionDescriptor[] = [];
  for (const option of options) {
    if (option.value === undefined) continue;
    result.push({ label: option.label, value: option.value });
  }
  return result;
}

/** Store preset bounds as ISO instants so they survive JSON. */
function toPresetDescriptor(preset: DatePreset): DatePresetDescriptor {
  return {
    label: preset.label,
    shortcut: preset.shortcut,
    from: preset.from.toISOString(),
    to: preset.to.toISOString(),
  };
}

/** Revive a serialized preset back into the `DatePreset` the UI consumes. */
export function fromPresetDescriptor(
  descriptor: DatePresetDescriptor,
): DatePreset {
  return {
    label: descriptor.label,
    shortcut: descriptor.shortcut,
    from: new Date(descriptor.from),
    to: new Date(descriptor.to),
  };
}

// ── The builder ─────────────────────────────────────────────────────────────

/**
 * Build a `ColBuilder` over an explicit descriptor + renderers pair.
 *
 * Exported because `deserializeSchema` reconstructs builders by handing a
 * descriptor straight back — no per-field replay of the fluent chain.
 */
export function createColBuilder<T, F extends FilterType = FilterType>(
  descriptor: ColumnDescriptor,
  renderers: ColRenderers = {},
): ColBuilder<T, F> {
  // The implementation uses loose parameter types to satisfy all overload
  // signatures at once. TypeScript enforces the constraints at call sites
  // via the ColBuilder<T, F> interface overloads, not here.
  const next = <U, G extends FilterType>(
    patch: Partial<ColumnDescriptor>,
    rendererPatch?: ColRenderers,
  ): ColBuilder<U, G> =>
    createColBuilder<U, G>(
      { ...descriptor, ...patch } as ColumnDescriptor,
      rendererPatch ? compact({ ...renderers, ...rendererPatch }) : renderers,
    );

  /** Return `renderers` without the named closures. */
  const withoutRenderers = (...keys: (keyof ColRenderers)[]): ColRenderers => {
    const result = { ...renderers };
    for (const key of keys) delete result[key];
    return result;
  };

  const builder = {
    get _descriptor() {
      return descriptor;
    },

    get _renderers() {
      return renderers;
    },

    label(text: string): ColBuilder<T, F> {
      return next<T, F>({ label: text });
    },

    description(text: string): ColBuilder<T, F> {
      return next<T, F>({ description: text });
    },

    display(type: string, options?: Record<string, unknown>): ColBuilder<T, F> {
      // "custom" is not a descriptor state — the closure goes to the renderers
      // half and the descriptor keeps whatever serializable display it had, so
      // it is already the correct fallback for the sheet and for toJSON().
      if (type === "custom") {
        const { cell, colorMap } = options as {
          cell: ColRenderers["cell"];
          colorMap?: Record<string, string>;
        };
        return next<T, F>(
          colorMap
            ? {
                display: {
                  ...descriptor.display,
                  colorMap,
                } as DisplayDescriptor,
              }
            : {},
          { cell },
        );
      }
      const display = compact(
        options ? { type, ...options } : { type },
      ) as DisplayDescriptor;
      // Selecting a built-in display drops any custom cell closure — otherwise
      // it keeps winning in `generateColumns`, which checks renderers first.
      return createColBuilder<T, F>(
        { ...descriptor, display },
        withoutRenderers("cell"),
      );
    },

    filterable(
      type?: string,
      options?: Record<string, unknown>,
    ): ColBuilder<T, F> {
      const filterType = (type ||
        descriptor.filter?.type ||
        "input") as FilterType;
      const existing = descriptor.filter;
      const sameType = filterType === existing?.type;
      const {
        component,
        options: rawOptions,
        presets: rawPresets,
        ...rest
      } = (options ?? {}) as {
        component?: ColRenderers["filterComponent"];
        options?: Option[];
        presets?: DatePreset[];
        min?: number;
        max?: number;
        unit?: string;
      };

      const filter: FilterDescriptor = {
        type: filterType,
        defaultOpen: existing?.defaultOpen ?? false,
        commandDisabled: existing?.commandDisabled ?? false,
        // Preserve auto-derived options when the filter type stays the same
        // and no explicit options are provided by the caller.
        ...(sameType && existing?.options ? { options: existing.options } : {}),
        ...compact(rest),
        ...(rawOptions ? { options: toOptionDescriptors(rawOptions) } : {}),
        ...(rawPresets
          ? { presets: rawPresets.map(toPresetDescriptor) }
          : sameType && existing?.presets
            ? { presets: existing.presets }
            : {}),
      };
      return next<T, F>(
        { filter },
        component ? { filterComponent: component } : undefined,
      );
    },

    notFilterable(): ColBuilder<T, never> {
      return createColBuilder<T, never>(
        { ...descriptor, filter: null },
        // The filter component is meaningless without a filter.
        withoutRenderers("filterComponent"),
      );
    },

    defaultOpen(): ColBuilder<T, F> {
      if (!descriptor.filter) return next<T, F>({});
      return next<T, F>({
        filter: { ...descriptor.filter, defaultOpen: true },
      });
    },

    commandDisabled(): ColBuilder<T, F> {
      if (!descriptor.filter) return next<T, F>({});
      return next<T, F>({
        filter: { ...descriptor.filter, commandDisabled: true },
      });
    },

    hidden(): ColBuilder<T, F> {
      return next<T, F>({ hidden: true });
    },

    hideHeader(): ColBuilder<T, F> {
      return next<T, F>({ hideHeader: true });
    },

    resizable(): ColBuilder<T, F> {
      return next<T, F>({ resizable: true });
    },

    size(px: number): ColBuilder<T, F> {
      return next<T, F>({ size: px });
    },

    sortable(): ColBuilder<T, F> {
      return next<T, F>({ sortable: true });
    },

    optional(): ColBuilder<T | undefined, F> {
      return next<T | undefined, F>({ optional: true });
    },

    sheet(sheetConfig?: SheetConfig): ColBuilder<T, F> {
      const { component, condition, ...sheetDescriptor } = sheetConfig ?? {};
      return next<T, F>(
        { sheet: compact(sheetDescriptor) },
        compact({ sheetComponent: component, sheetCondition: condition }),
      );
    },

    sheetOnly(): ColBuilder<T, never> {
      return createColBuilder<T, never>(
        {
          ...descriptor,
          hidden: true,
          filter: null,
          enableHiding: false,
        },
        withoutRenderers("filterComponent"),
      );
    },
  } as ColBuilder<T, F>;

  return builder;
}

/**
 * Attach provenance to a builder.
 *
 * Internal to this package — `col.presets.*` records which preset produced the
 * column and with what arguments, and `infer.ts` records which heuristic fired.
 * `schemaToTypeScript` reads this instead of pattern-matching the descriptor.
 */
export function withProvenance<T, F extends FilterType>(
  builder: ColBuilder<T, F>,
  provenance: Provenance,
): ColBuilder<T, F> {
  return createColBuilder<T, F>(
    { ...builder._descriptor, provenance },
    builder._renderers,
  );
}

// ── The public read model ───────────────────────────────────────────────────

/**
 * Read a column's complete state — both halves — through one public accessor.
 *
 * Prefer this over reaching into `_descriptor` / `_renderers`, which are
 * `@internal` and may change shape.
 */
// `any` on the filter-type parameter: callers hold builders of every filter
// type at once, and the read model does not depend on which one it is.
export function resolveColumn(
  builder: ColBuilder<unknown, any>,
): ResolvedColumn {
  return { ...builder._descriptor, renderers: builder._renderers };
}

/** `resolveColumn` over a whole definition, preserving key insertion order. */
export function resolveColumns(
  definition: TableSchemaDefinition,
): ResolvedColumnEntry[] {
  return Object.entries(definition).map(([key, builder]) => ({
    key,
    ...resolveColumn(builder),
  }));
}

// ── Factories ───────────────────────────────────────────────────────────────

/** The descriptor every `col.*` factory starts from, before kind-specific bits. */
function base(kind: ColKind): ColumnDescriptorCommon {
  return {
    optional: false,
    label: "",
    display: defaultDisplayForKind(kind),
    hidden: false,
    enableHiding: true,
    hideHeader: false,
    resizable: false,
    sortable: false,
    filter: null,
    sheet: null,
    provenance: MANUAL,
  };
}

/**
 * A string column.
 *
 * - Data type: `string`
 * - Default display: `"text"` (plain text with overflow tooltip)
 * - Default filter: `"input"` (text search)
 * - Allowed filters: `"input"`
 *
 * @example
 * col.string().label("Host").size(125).sheet()
 * col.string().label("Message").notFilterable().optional().hidden()
 */
function string(): ColBuilder<string, "input"> {
  return createColBuilder<string, "input">({
    ...base("string"),
    kind: "string",
    filter: { type: "input", defaultOpen: false, commandDisabled: false },
  });
}

/**
 * A numeric column.
 *
 * - Data type: `number`
 * - Default display: `"number"` (formatted, with optional unit)
 * - Default filter: `"input"` (exact match)
 * - Allowed filters: `"input"` | `"slider"` | `"checkbox"`
 *   - Use `"slider"` for continuous values (latency, file size)
 *   - Use `"checkbox"` for discrete values (HTTP status codes, port numbers)
 *
 * @example
 * col.number().label("Latency").display("number", { unit: "ms" }).filterable("slider", { min: 0, max: 5000 }).sortable()
 * col.number().label("Status").filterable("checkbox", { options: [{ label: "200", value: 200 }] })
 */
function number(): ColBuilder<number, "input" | "slider" | "checkbox"> {
  return createColBuilder<number, "input" | "slider" | "checkbox">({
    ...base("number"),
    kind: "number",
    filter: { type: "input", defaultOpen: false, commandDisabled: false },
  });
}

/**
 * A boolean column.
 *
 * - Data type: `boolean`
 * - Default display: `"boolean"` (checkmark / dash icon)
 * - Default filter: `"checkbox"` with `true` / `false` options pre-wired
 * - Allowed filters: `"checkbox"`
 *
 * @example
 * col.boolean().label("Cache Hit").defaultOpen()
 */
function boolean(): ColBuilder<boolean, "checkbox"> {
  return createColBuilder<boolean, "checkbox">({
    ...base("boolean"),
    kind: "boolean",
    filter: {
      type: "checkbox",
      defaultOpen: false,
      commandDisabled: false,
      options: [
        { label: "true", value: true },
        { label: "false", value: false },
      ],
    },
  });
}

/**
 * A timestamp column.
 *
 * - Data type: `Date`
 * - Default display: `"timestamp"` (relative time, absolute datetime on hover)
 * - Default filter: `"timerange"` (date range picker)
 * - Allowed filters: `"timerange"`
 *
 * @example
 * col.timestamp().label("Date").sortable().commandDisabled().size(200).sheet()
 */
function timestamp(): ColBuilder<Date, "timerange"> {
  return createColBuilder<Date, "timerange">({
    ...base("timestamp"),
    kind: "timestamp",
    filter: { type: "timerange", defaultOpen: false, commandDisabled: true },
  });
}

/**
 * An enum column from a `readonly string[]` union.
 *
 * - Data type: `T[number]` (union of the provided string literals)
 * - Default display: `"badge"` (colored chip)
 * - Default filter: `"checkbox"` with options auto-derived from `values`
 * - Allowed filters: `"checkbox"`
 *
 * Checkbox options are auto-derived from `values` by default. Override them via
 * `.filterable("checkbox", { options: [...] })` when you need custom labels,
 * icons, or a subset of values.
 *
 * @param values - `as const` array of allowed string values
 *
 * @example
 * col.enum(LEVELS).label("Level").defaultOpen()
 * col.enum(LEVELS).label("Level").filterable("checkbox", {
 *   options: LEVELS.map(v => ({ label: v, value: v })), // override labels
 * })
 */
function colEnum<T extends readonly string[]>(
  values: T,
): ColBuilder<T[number], "checkbox"> {
  return createColBuilder<T[number], "checkbox">({
    ...base("enum"),
    kind: "enum",
    enumValues: values,
    filter: {
      type: "checkbox",
      defaultOpen: false,
      commandDisabled: false,
      options: Array.from(values).map((v) => ({ label: v, value: v })),
    },
  });
}

/**
 * An array column, typically used for multi-value enum fields.
 *
 * - Data type: `U[]` where `U` is the item builder's type
 * - Default display: `"badge"` (colored chip per value)
 * - Default filter: `"checkbox"`
 * - Allowed filters: `"checkbox"`
 *
 * Most commonly used as `col.array(col.enum(values))` for tags / regions / labels.
 * `col.array(col.string())` is equally valid — the item type is recorded, so a
 * `string[]` column stays a `string[]` column across a JSON round trip.
 *
 * @param itemBuilder - A `ColBuilder` describing the array item type
 *
 * @example
 * col.array(col.enum(REGIONS)).label("Regions").filterable("checkbox", {
 *   options: REGIONS.map(r => ({ label: r, value: r })),
 * })
 */
function array<U>(
  itemBuilder: ColBuilder<U, any>,
): ColBuilder<U[], "checkbox"> {
  return createColBuilder<U[], "checkbox">({
    ...base("array"),
    kind: "array",
    arrayItem: itemBuilder._descriptor,
    filter: { type: "checkbox", defaultOpen: false, commandDisabled: false },
  });
}

/**
 * A key-value record column.
 *
 * - Data type: `Record<string, string>`
 * - Default display: `"text"`
 * - Not filterable (`F = never`)
 *
 * Use for metadata maps, HTTP headers, environment variables, etc.
 * Typically rendered with a custom sheet component (key-value table / tabs).
 *
 * @example
 * col.record().label("Headers").hidden().sheet({
 *   component: (row) => <KVTabs data={row.headers} />,
 *   className: "flex-col items-start w-full gap-1",
 * })
 */
function record(): ColBuilder<Record<string, string>, never> {
  return createColBuilder<Record<string, string>, never>({
    ...base("record"),
    kind: "record",
  });
}

/**
 * A row-selection checkbox column.
 *
 * - Data type: `boolean` (selected state)
 * - Not filterable (`F = never`)
 * - Not shown in sheet or filters
 * - Renders a checkbox in both the header (select all) and each row
 *
 * @example
 * col.select().label("Select")
 */
function select(): ColBuilder<boolean, never> {
  return createColBuilder<boolean, never>({
    ...base("select"),
    kind: "select",
    label: "Select",
    enableHiding: false,
    size: 40,
  });
}

export const col = {
  string,
  number,
  boolean,
  timestamp,
  enum: colEnum,
  array,
  record,
  select,
};
