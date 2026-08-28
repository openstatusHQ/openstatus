import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@openstatus/ui/lib/data-table-filters/delimiters";
import { isArrayOfDates } from "@openstatus/ui/lib/data-table-filters/is-array";
import type {
  FieldBuilder,
  SchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/store/schema/types";
import {
  serializeFilterValue,
  tokenizeFilterInput,
} from "@openstatus/ui/lib/data-table-filters/tokenize";
import type { ColumnFiltersState } from "@tanstack/react-table";

import type { DataTableFilterField } from "../types";

export {
  serializeFilterValue,
  tokenizeFilterInput,
} from "@openstatus/ui/lib/data-table-filters/tokenize";

/**
 * Extracts the word from the given string at the specified caret position.
 */
export function getWordByCaretPosition({
  value,
  caretPosition,
}: {
  value: string;
  caretPosition: number;
}) {
  let start = caretPosition;
  let end = caretPosition;

  while (start > 0 && value[start - 1] !== " ") start--;
  while (end < value.length && value[end] !== " ") end++;

  const word = value.substring(start, end);
  return word;
}

/**
 * Quote a value if it contains spaces
 */
function quoteIfNeeded(val: string | number | boolean | undefined): string {
  const str = `${val}`;
  if (str.includes(" ")) {
    return `"${str}"`;
  }
  return str;
}

export function replaceInputByFieldType<TData>({
  prev,
  currentWord,
  optionValue,
  value,
  field,
}: {
  prev: string;
  currentWord: string;
  optionValue?: string | number | boolean | undefined; // FIXME: use DataTableFilterField<TData>["options"][number];
  value: string;
  field: DataTableFilterField<TData>;
}) {
  switch (field.type) {
    case "checkbox": {
      if (currentWord.includes(ARRAY_DELIMITER)) {
        const words = currentWord.split(ARRAY_DELIMITER);
        words[words.length - 1] = quoteIfNeeded(optionValue);
        const input = prev.replace(currentWord, words.join(ARRAY_DELIMITER));
        return `${input.trim()} `;
      }
      break;
    }
    case "slider": {
      if (currentWord.includes(SLIDER_DELIMITER)) {
        const words = currentWord.split(SLIDER_DELIMITER);
        words[words.length - 1] = `${optionValue}`;
        const input = prev.replace(currentWord, words.join(SLIDER_DELIMITER));
        return `${input.trim()} `;
      }
      break;
    }
    case "timerange": {
      if (currentWord.includes(RANGE_DELIMITER)) {
        const words = currentWord.split(RANGE_DELIMITER);
        words[words.length - 1] = `${optionValue}`;
        const input = prev.replace(currentWord, words.join(RANGE_DELIMITER));
        return `${input.trim()} `;
      }
      break;
    }
  }

  // Default: set a fresh filter value, quoting if it contains spaces
  const quotedValue = quoteIfNeeded(optionValue) || value;
  const input = prev.replace(
    currentWord,
    `${String(field.value)}:${quotedValue}`,
  );
  return `${input.trim()} `;
}

export function getFieldOptions<TData>({
  field,
  facetedValue,
}: {
  field: DataTableFilterField<TData>;
  facetedValue?: Map<unknown, number>;
}) {
  switch (field.type) {
    case "slider": {
      if (field.options?.length) {
        return field.options
          .map(({ value }) => value)
          .sort((a, b) => Number(a) - Number(b))
          .filter(notEmpty);
      }
      // Use only the values that actually exist in the data to avoid
      // generating thousands of intermediate integers (e.g. salary 58k-155k).
      if (facetedValue?.size) {
        return Array.from(facetedValue.keys())
          .map(Number)
          .filter((n) => !isNaN(n))
          .sort((a, b) => a - b);
      }
      return [];
    }
    default: {
      return field.options?.map(({ value }) => value).filter(notEmpty) || [];
    }
  }
}

export function getFilterValue({
  value,
  search,
  currentWord,
}: {
  value: string;
  search: string;
  keywords?: string[] | undefined;
  currentWord: string;
}): number {
  /**
   * @example value "suggestion:public:true regions,ams,gru,fra"
   */
  if (value.startsWith("suggestion:")) {
    const rawValue = value.toLowerCase().replace("suggestion:", "");
    if (rawValue.includes(search)) return 1;
    return 0;
  }

  /** */
  if (value.toLowerCase().includes(currentWord.toLowerCase())) return 1;

  /**
   * @example checkbox [filter, query] = ["regions", "ams,gru,fra"]
   * @example slider [filter, query] = ["p95", "0-3000"]
   * @example input [filter, query] = ["name", "api"]
   */
  // Split on the FIRST colon only — values legitimately contain colons (urls,
  // timestamps), and `split(":")` would truncate the query at the second one.
  const lowerCurrentWord = currentWord.toLowerCase();
  const separatorIndex = lowerCurrentWord.indexOf(":");
  const filter =
    separatorIndex === -1
      ? lowerCurrentWord
      : lowerCurrentWord.slice(0, separatorIndex);
  const query =
    separatorIndex === -1
      ? undefined
      : lowerCurrentWord.slice(separatorIndex + 1);
  if (query && value.startsWith(`${filter}:`)) {
    if (query.includes(ARRAY_DELIMITER)) {
      /**
       * array of n elements
       * @example queries = ["ams", "gru", "fra"]
       */
      const queries = query.split(ARRAY_DELIMITER);
      const rawValue = value.toLowerCase().replace(`${filter}:`, "");
      if (
        queries.some((item, i) => item === rawValue && i !== queries.length - 1)
      )
        return 0;
      if (queries.some((item) => rawValue.includes(item))) return 1;
    }
    if (query.includes(SLIDER_DELIMITER)) {
      /**
       * range between 2 elements
       * @example queries = ["0", "3000"]
       */
      const queries = query.split(SLIDER_DELIMITER);
      const rawValue = value.toLowerCase().replace(`${filter}:`, "");

      const rawValueAsNumber = Number.parseInt(rawValue);
      const queryAsNumber = Number.parseInt(queries[0]);

      if (queryAsNumber < rawValueAsNumber) {
        if (rawValue.includes(queries[1])) return 1;
        return 0;
      }
      return 0;
    }
    const rawValue = value.toLowerCase().replace(`${filter}:`, "");
    if (rawValue.includes(query)) return 1;
  }
  return 0;
}

export function getFieldValueByType<TData>({
  field,
  value,
}: {
  field?: DataTableFilterField<TData>;
  value: unknown;
}) {
  if (!field) return null;

  switch (field.type) {
    case "slider": {
      if (Array.isArray(value)) {
        return value.join(SLIDER_DELIMITER);
      }
      return value;
    }
    case "checkbox": {
      if (Array.isArray(value)) {
        return value.join(ARRAY_DELIMITER);
      }
      // REMINER: inversed logic
      if (typeof value === "string") {
        return value.split(ARRAY_DELIMITER);
      }
      return value;
    }
    case "timerange": {
      if (Array.isArray(value)) {
        if (isArrayOfDates(value)) {
          return value.map((date) => date.getTime()).join(RANGE_DELIMITER);
        }
        return value.join(RANGE_DELIMITER);
      }
      if (value instanceof Date) {
        return value.getTime();
      }
      return value;
    }
    default: {
      return value;
    }
  }
}

export function notEmpty<TValue>(
  value: TValue | null | undefined,
): value is TValue {
  return value !== null && value !== undefined;
}

/**
 * Schema-based column filters parser for BYOS
 *
 * This parser works with the new schema system instead of nuqs ParserBuilder.
 */
export function columnFiltersParserFromSchema<TData>({
  schema,
  filterFields,
}: {
  schema: SchemaDefinition;
  filterFields: DataTableFilterField<TData>[];
}) {
  return {
    parse: (inputValue: string) => {
      // Use tokenizer that respects quoted values
      const tokens = tokenizeFilterInput(inputValue);
      const values = tokens.reduce(
        (prev, [name, value]) => {
          prev[name] = value;
          return prev;
        },
        {} as Record<string, string>,
      );

      const searchParams = Object.entries(values).reduce(
        (prev, [key, value]) => {
          // mirror `serialize`: only fields the command exposes can be typed
          const field = filterFields?.find((f) => f.value === key);
          if (!field || field.commandDisabled) return prev;

          // own-property only: `toString:x` would otherwise resolve on the prototype
          if (!Object.prototype.hasOwnProperty.call(schema, key)) return prev;
          const fieldBuilder = schema[key] as FieldBuilder<unknown> | undefined;
          if (!fieldBuilder) return prev;

          try {
            let parsed = fieldBuilder._config.parse(value);
            if (parsed !== null) {
              // Slider fields expect [min, max] for inNumberRange — if a single
              // value is provided (e.g. "amount:1800"), duplicate it so the range
              // becomes [1800, 1800] (exact match).
              if (
                field.type === "slider" &&
                Array.isArray(parsed) &&
                parsed.length === 1
              ) {
                parsed = [parsed[0], parsed[0]];
              }
              prev[key] = parsed;
            }
          } catch {
            // skip fields whose custom parser rejects the input
          }
          return prev;
        },
        {} as Record<string, unknown>,
      );

      return searchParams;
    },
    serialize: (columnFilters: ColumnFiltersState) => {
      const values = columnFilters.reduce((prev, curr) => {
        const { commandDisabled } = filterFields?.find(
          (field) => curr.id === field.value,
        ) || { commandDisabled: true };
        const fieldBuilder = Object.prototype.hasOwnProperty.call(
          schema,
          curr.id,
        )
          ? (schema[curr.id] as FieldBuilder<unknown> | undefined)
          : undefined;

        if (commandDisabled || !fieldBuilder) return prev;

        let serialized: string;
        try {
          serialized = fieldBuilder._config.serialize(curr.value);
        } catch {
          return prev;
        }
        if (!serialized) return prev;

        const quotedValue = serializeFilterValue(serialized);
        return `${prev}${curr.id}:${quotedValue} `;
      }, "");

      return values;
    },
  };
}
