import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@openstatus/ui/lib/data-table-filters/delimiters";
import {
  createSchema,
  field,
} from "@openstatus/ui/lib/data-table-filters/store/schema/index";
import type {
  FieldBuilder,
  Schema,
  SchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/store/schema/index";

import { resolveColumns } from "../col";
import type { ColBuilder, TableSchemaDefinition } from "../types";

/**
 * Extract keys from a TableSchemaDefinition where the column is filterable.
 * A column is filterable when its filter type `F` is not `never`.
 * Uses `[F] extends [never]` to avoid distribution issues with `any`.
 */
type FilterableKeys<T extends TableSchemaDefinition> = {
  [K in keyof T]: T[K] extends ColBuilder<infer _T, infer F>
    ? [F] extends [never]
      ? never
      : K
    : never;
}[keyof T];

// Extract T and F separately — TS struggles to infer both at once from ColBuilder
type GetColValue<B> = B extends ColBuilder<infer T, any> ? T : never;
type GetColFilter<B> = B extends ColBuilder<any, infer F> ? F : never;

/**
 * Map a single ColBuilder to the correct FieldBuilder type based on its
 * value type `T` and filter type `F`.
 */
type InferFilterFieldType<B> = [GetColFilter<B>] extends [never]
  ? never
  : GetColFilter<B> extends "input"
    ? GetColValue<B> extends string
      ? FieldBuilder<string | null>
      : GetColValue<B> extends number
        ? FieldBuilder<number | null>
        : FieldBuilder<unknown>
    : GetColFilter<B> extends "slider"
      ? FieldBuilder<(number | null)[]>
      : GetColFilter<B> extends "timerange"
        ? FieldBuilder<(Date | null)[]>
        : GetColFilter<B> extends "checkbox"
          ? GetColValue<B> extends (infer U)[]
            ? FieldBuilder<(U | null)[]>
            : FieldBuilder<(GetColValue<B> | null)[]>
          : FieldBuilder<unknown>;

/** The generated filter definition — preserves the filterable keys from `T`. */
type GeneratedFilterDef<T extends TableSchemaDefinition> = {
  [K in FilterableKeys<T>]: InferFilterFieldType<T[K]>;
};

/**
 * A numeric field that survives decimals.
 *
 * `field.number()` parses with `parseInt`, so a latency of `1.5` comes back
 * from the URL as `1`. Numeric columns are continuous far more often than not,
 * so every numeric filter branch uses this instead.
 */
function decimalNumber(): FieldBuilder<number | null> {
  return field.number().parse((str) => {
    if (str.trim() === "") return null;
    const num = Number(str);
    return Number.isFinite(num) ? num : null;
  });
}

function buildFilterDefinition(
  schema: TableSchemaDefinition,
): SchemaDefinition {
  const definition: SchemaDefinition = {};

  for (const config of resolveColumns(schema)) {
    const { key, kind, filter } = config;
    if (!filter) continue;

    switch (filter.type) {
      case "input": {
        if (kind === "string") {
          definition[key] = field.string();
        } else if (kind === "number") {
          definition[key] = decimalNumber();
        }
        break;
      }
      case "checkbox": {
        if (config.kind === "enum") {
          definition[key] = field.array(field.stringLiteral(config.enumValues));
        } else if (kind === "number") {
          definition[key] = field
            .array(decimalNumber())
            .delimiter(ARRAY_DELIMITER);
        } else if (kind === "boolean") {
          definition[key] = field
            .array(field.boolean())
            .delimiter(ARRAY_DELIMITER);
        } else if (
          config.kind === "array" &&
          config.arrayItem.kind === "enum"
        ) {
          definition[key] = field.array(
            field.stringLiteral(config.arrayItem.enumValues),
          );
        } else if (config.kind === "array") {
          // Non-enum array item — filter on the item's own scalar type.
          definition[key] =
            config.arrayItem.kind === "number"
              ? field.array(decimalNumber()).delimiter(ARRAY_DELIMITER)
              : field.array(field.string()).delimiter(ARRAY_DELIMITER);
        }
        break;
      }
      case "slider": {
        definition[key] = field
          .array(decimalNumber())
          .delimiter(SLIDER_DELIMITER);
        break;
      }
      case "timerange": {
        definition[key] = field
          .array(field.timestamp())
          .delimiter(RANGE_DELIMITER);
        break;
      }
    }
  }

  return definition;
}

/**
 * Generate a BYOS filter schema from a table schema definition.
 *
 * Each filterable column maps to the appropriate field.* builder:
 * - col.string()  + input    → field.string()
 * - col.number()  + input    → field.number()
 * - col.number()  + slider   → field.array(field.number()).delimiter(SLIDER_DELIMITER)
 * - col.number()  + checkbox → field.array(field.number()).delimiter(ARRAY_DELIMITER)
 * - col.boolean() + checkbox → field.array(field.boolean()).delimiter(ARRAY_DELIMITER)
 * - col.timestamp()+ timerange→ field.array(field.timestamp()).delimiter(RANGE_DELIMITER)
 * - col.enum(v)   + checkbox → field.array(field.stringLiteral(v))
 * - col.array(col.enum(v)) + checkbox → field.array(field.stringLiteral(v))
 *
 * Every numeric field carries a decimal-safe parse — `field.number()` on its
 * own truncates `1.5` to `1`.
 *
 * Non-filterable fields are excluded. Pass `extraFields` for pagination,
 * sorting, and other non-filter state.
 *
 * @example
 * ```ts
 * // Without extra fields (filter fields only)
 * const filterSchema = generateFilterSchema(tableSchema.definition);
 *
 * // With extra fields (recommended)
 * const filterSchema = generateFilterSchema(tableSchema.definition, {
 *   sort: field.sort(),
 *   uuid: field.string(),
 *   live: field.boolean().default(false),
 *   size: field.number().default(40),
 * });
 * ```
 */
export function generateFilterSchema<T extends TableSchemaDefinition>(
  schema: T,
): Schema<GeneratedFilterDef<T>>;
export function generateFilterSchema<
  T extends TableSchemaDefinition,
  E extends SchemaDefinition,
>(schema: T, extraFields: E): Schema<GeneratedFilterDef<T> & E>;
export function generateFilterSchema<
  T extends TableSchemaDefinition,
  E extends SchemaDefinition,
>(schema: T, extraFields?: E) {
  const generated = buildFilterDefinition(schema);
  const merged = extraFields ? { ...generated, ...extraFields } : generated;
  return createSchema(merged);
}
