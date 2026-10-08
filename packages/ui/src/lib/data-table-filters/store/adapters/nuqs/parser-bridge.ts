import { SORT_DELIMITER } from "@openstatus/ui/lib/data-table-filters/delimiters";
import {
  createParser,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  parseAsTimestamp,
  type ParserBuilder,
} from "nuqs/server";

import type {
  FieldBuilder,
  FieldConfig,
  SchemaDefinition,
} from "../../schema/types";

/**
 * Type mapping: Schema field type → nuqs ParserBuilder type
 */
export type SchemaToNuqsParsers<T extends SchemaDefinition> = {
  [K in keyof T]: T[K] extends FieldBuilder<infer U>
    ? ParserBuilder<U>
    : ParserBuilder<unknown>;
};

/**
 * Convert a single field config to a nuqs parser
 */
function fieldConfigToParser(
  config: FieldConfig<unknown>,
): ParserBuilder<unknown> {
  // A schema-level serialize/parse override defines the URL format, so it wins
  // over the built-in parser for the field type
  if (config.hasCustomTransform) {
    return createParser({
      parse: (queryValue: string) => config.parse(queryValue),
      serialize: (value: unknown) => config.serialize(value),
    }) as ParserBuilder<unknown>;
  }

  switch (config.type) {
    case "string":
      return parseAsString as ParserBuilder<unknown>;

    case "number":
      return parseAsInteger as ParserBuilder<unknown>;

    case "boolean":
      return parseAsBoolean as ParserBuilder<unknown>;

    case "timestamp":
      return parseAsTimestamp as ParserBuilder<unknown>;

    case "stringLiteral":
      if (config.literals) {
        return parseAsStringLiteral(
          config.literals as unknown as readonly string[],
        ) as ParserBuilder<unknown>;
      }
      return parseAsString as ParserBuilder<unknown>;

    case "array":
      if (config.itemConfig) {
        const itemParser = fieldConfigToParser(config.itemConfig);
        return parseAsArrayOf(
          itemParser as ParserBuilder<string>,
          config.delimiter,
        ) as ParserBuilder<unknown>;
      }
      return parseAsArrayOf(
        parseAsString,
        config.delimiter,
      ) as ParserBuilder<unknown>;

    case "sort":
      return createParser({
        parse(queryValue: string) {
          const [id, desc] = queryValue.split(SORT_DELIMITER);
          if (!id) return null;
          return { id, desc: desc === "desc" };
        },
        serialize(value: { id: string; desc: boolean }) {
          return `${value.id}${SORT_DELIMITER}${value.desc ? "desc" : "asc"}`;
        },
      }) as ParserBuilder<unknown>;

    default:
      return parseAsString as ParserBuilder<unknown>;
  }
}

/**
 * Apply default value to a nuqs parser
 */
function applyDefault(
  parser: ParserBuilder<unknown>,
  defaultValue: unknown,
): ParserBuilder<unknown> {
  if (defaultValue !== null && defaultValue !== undefined) {
    // Arrays default to empty array, not worth adding .withDefault
    if (Array.isArray(defaultValue) && defaultValue.length === 0) {
      return parser;
    }
    // Only apply withDefault for non-null primitive defaults
    if (
      typeof defaultValue === "string" ||
      typeof defaultValue === "number" ||
      typeof defaultValue === "boolean" ||
      defaultValue instanceof Date
    ) {
      return (
        parser as ParserBuilder<unknown> & {
          withDefault: (d: unknown) => ParserBuilder<unknown>;
        }
      ).withDefault(defaultValue);
    }
  }
  return parser;
}

/**
 * Convert a schema definition to nuqs parsers
 *
 * @example
 * ```typescript
 * const schema = createSchema({
 *   level: field.array(field.string()),
 *   latency: field.number(),
 * });
 *
 * // Type is inferred: { level: ParserBuilder<string[]>, latency: ParserBuilder<number> }
 * const parsers = schemaToNuqsParsers(schema.definition);
 * ```
 */
export function schemaToNuqsParsers<T extends SchemaDefinition>(
  schema: T,
): SchemaToNuqsParsers<T> {
  const parsers: Record<string, ParserBuilder<unknown>> = {};

  for (const [key, fieldBuilder] of Object.entries(schema)) {
    const config = fieldBuilder._config;
    let parser = fieldConfigToParser(config);
    parser = applyDefault(parser, config.defaultValue);
    parsers[key] = parser;
  }

  return parsers as SchemaToNuqsParsers<T>;
}

/**
 * Create a nuqs cache serializer from schema
 */
export function createSchemaSerializer(schema: SchemaDefinition) {
  const parsers = schemaToNuqsParsers(schema);

  return (state: Record<string, unknown>): string => {
    const params = new URLSearchParams();

    for (const [key, parser] of Object.entries(parsers)) {
      const value = state[key];
      if (value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;

      try {
        const serialized = (
          parser as { serialize?: (v: unknown) => string }
        ).serialize?.(value);
        if (serialized) {
          params.set(key, serialized);
        }
      } catch {
        // Skip invalid values
      }
    }

    const str = params.toString();
    return str ? `?${str}` : "";
  };
}
