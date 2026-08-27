import { resolveColumns } from "./col";
import type { TableSchemaDefinition } from "./types";

/**
 * Validates a table schema definition and throws a descriptive error on the
 * first violation found.
 *
 * Called automatically by `createTableSchema()` — no need to call manually.
 *
 * Catches errors that the TypeScript type system cannot prevent:
 * - Missing label (`.label()` was never called)
 * - Slider `min` greater than `max`
 *
 * These checks run for both the TypeScript-authored path (`createTableSchema({...})`)
 * and the AI-generated path (`createTableSchema.fromJSON(json)`).
 */
export function validateSchema(definition: TableSchemaDefinition): void {
  for (const c of resolveColumns(definition)) {
    const { key } = c;

    // 1. Label is required — col.* factories default to label: ""
    if (!c.label) {
      throw new Error(
        `[createTableSchema] Column "${key}" is missing a label.\n` +
          `  Fix: .label("${key[0]!.toUpperCase()}${key.slice(1)}")`,
      );
    }

    // 2. Number checkbox filter requires explicit options — the number factory
    //    has no value list to auto-derive from, so an empty options list would
    //    render a filter with no checkboxes (a silent no-op in the UI).
    if (
      c.kind === "number" &&
      c.filter?.type === "checkbox" &&
      (!c.filter.options || c.filter.options.length === 0)
    ) {
      throw new Error(
        `[createTableSchema] Column "${key}": checkbox filter on a number column requires explicit options.\n` +
          `  Fix: .filterable("checkbox", { options: [{ label: "200", value: 200 }, ...] })`,
      );
    }

    // 3. Slider bounds must be valid — type system requires { min, max } to be
    //    passed but cannot enforce min < max
    if (c.filter?.type === "slider") {
      const { min, max } = c.filter;
      if (min === undefined || max === undefined) {
        throw new Error(
          `[createTableSchema] Column "${key}": slider filter is missing min/max bounds.\n` +
            `  Fix: .filterable("slider", { min: 0, max: 100 })`,
        );
      }
      if (min > max) {
        throw new Error(
          `[createTableSchema] Column "${key}": slider min (${min}) must be less than max (${max}).\n` +
            `  Fix: swap the values — .filterable("slider", { min: ${max}, max: ${min} })`,
        );
      }
    }

    // 4. A sheet-only column cannot carry a filter. `.sheetOnly()` is the only
    //    chain step that sets `enableHiding: false` on a hideable column, and
    //    it clears the filter, so no builder can produce this combination —
    //    only hand-written or AI-generated JSON can. It has no chain form,
    //    which means `schemaToTypeScript` would have to drop one half of it.
    if (c.enableHiding === false && c.hidden && c.filter !== null) {
      throw new Error(
        `[createTableSchema] Column "${key}": a sheet-only column cannot have a filter.\n` +
          `  Fix: drop the filter (.sheetOnly() implies it), or make the column filterable and hidden instead.`,
      );
    }
  }
}
