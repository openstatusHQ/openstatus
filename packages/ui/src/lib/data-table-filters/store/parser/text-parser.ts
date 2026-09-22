import {
  serializeFilterValue,
  tokenizeFilterInput,
} from "@openstatus/ui/lib/data-table-filters/tokenize";

import type {
  FieldBuilder,
  InferSchemaType,
  SchemaDefinition,
} from "../schema/types";
import type { TextParser, TextParserOptions } from "./types";

/**
 * Create a text parser for filter command input
 *
 * @example
 * ```typescript
 * import { createTextParser } from '@openstatus/ui/lib/data-table-filters/store/parser';
 *
 * const parser = createTextParser(schema.definition, {
 *   aliases: { l: 'level', r: 'regions' },
 * });
 *
 * // Parse text to state
 * const state = parser.parse('level:error,warn regions:ams');
 *
 * // Serialize state to text
 * const text = parser.serialize({ level: ['error', 'warn'], regions: ['ams'] });
 * ```
 */
export function createTextParser<T extends SchemaDefinition>(
  schema: T,
  options: TextParserOptions = {},
): TextParser<T> {
  const {
    aliases = {},
    fieldDelimiter = " ",
    keyValueDelimiter = ":",
  } = options;

  // Build reverse alias map
  const reverseAliases: Record<string, string> = {};
  for (const [alias, field] of Object.entries(aliases)) {
    reverseAliases[field] = alias;
  }

  // Resolve alias to field name
  const resolveAlias = (key: string): string => {
    return aliases[key] || key;
  };

  return {
    parse(input: string): Partial<InferSchemaType<T>> {
      const result: Record<string, unknown> = {};

      if (!input.trim()) {
        return result as Partial<InferSchemaType<T>>;
      }

      const tokens = tokenizeFilterInput(input, {
        fieldDelimiter,
        keyValueDelimiter,
      });

      for (const [rawKey, rawValue] of tokens) {
        if (!rawKey || !rawValue) continue;

        const fieldKey = resolveAlias(rawKey);
        // own-property only: `toString:x` would otherwise resolve on the prototype
        if (!Object.prototype.hasOwnProperty.call(schema, fieldKey)) continue;

        const fieldBuilder = schema[fieldKey] as
          | FieldBuilder<unknown>
          | undefined;

        if (!fieldBuilder) continue;

        try {
          const parsed = fieldBuilder._config.parse(rawValue);
          if (parsed !== null) {
            result[fieldKey] = parsed;
          }
        } catch {
          // Skip invalid values
        }
      }

      return result as Partial<InferSchemaType<T>>;
    },

    serialize(state: Partial<InferSchemaType<T>>): string {
      const parts: string[] = [];

      for (const [key, value] of Object.entries(state)) {
        if (value === null || value === undefined) continue;
        if (Array.isArray(value) && value.length === 0) continue;

        const fieldBuilder = schema[key] as FieldBuilder<unknown> | undefined;
        if (!fieldBuilder) continue;

        try {
          const serialized = fieldBuilder._config.serialize(value);
          if (serialized) {
            const quoted = serializeFilterValue(serialized, { fieldDelimiter });
            parts.push(`${key}${keyValueDelimiter}${quoted}`);
          }
        } catch {
          // Skip invalid values
        }
      }

      return parts.join(fieldDelimiter);
    },

    getWordAtCaret(input: string, caretPosition: number) {
      // Find word boundaries
      let start = caretPosition;
      let end = caretPosition;

      // Move start backwards to find word start
      while (start > 0 && input[start - 1] !== fieldDelimiter) {
        start--;
      }

      // Move end forwards to find word end
      while (end < input.length && input[end] !== fieldDelimiter) {
        end++;
      }

      const word = input.slice(start, end);
      const colonIndex = word.indexOf(keyValueDelimiter);

      let field: string | null = null;
      let value: string | null = null;

      if (colonIndex !== -1) {
        field = resolveAlias(word.slice(0, colonIndex));
        value = word.slice(colonIndex + 1);
      } else {
        // Could be a partial field name
        field = null;
        value = null;
      }

      return { word, start, end, field, value };
    },

    replaceWordAtCaret(
      input: string,
      caretPosition: number,
      replacement: string,
    ) {
      const { start, end } = this.getWordAtCaret(input, caretPosition);

      const before = input.slice(0, start);
      const after = input.slice(end);

      const newInput = before + replacement + after;
      const newCaretPosition = start + replacement.length;

      return { newInput, newCaretPosition };
    },

    getSuggestions(
      input: string,
      caretPosition: number,
      fieldOptions: Record<string, string[]>,
    ) {
      const { word, field, value } = this.getWordAtCaret(input, caretPosition);

      // If we have a field and are typing a value
      if (field && value !== null) {
        const options = fieldOptions[field] || [];
        const filtered = options.filter((opt) =>
          opt.toLowerCase().includes(value.toLowerCase()),
        );

        return {
          type: "value" as const,
          field,
          suggestions: filtered,
        };
      }

      // Otherwise, suggest field names
      const schemaKeys = Object.keys(schema);
      const aliasKeys = Object.keys(aliases);
      const allFields = [...schemaKeys, ...aliasKeys];

      const filtered = word
        ? allFields.filter((f) =>
            f.toLowerCase().startsWith(word.toLowerCase()),
          )
        : allFields;

      return {
        type: "field" as const,
        suggestions: filtered,
      };
    },
  };
}
