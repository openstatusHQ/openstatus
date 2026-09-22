import {
  ARRAY_DELIMITER,
  SLIDER_DELIMITER,
  SORT_DELIMITER,
} from "@openstatus/ui/lib/data-table-filters/delimiters";

import type { FieldBuilder, FieldConfig } from "./types";

// Helper to create a field builder from config
function createFieldBuilder<T>(config: FieldConfig<T>): FieldBuilder<T> {
  const builder: FieldBuilder<T> = {
    default(value: T) {
      return createFieldBuilder({ ...config, defaultValue: value });
    },

    delimiter(separator: string) {
      // Update serialize/parse functions when delimiter changes for arrays
      if (config.type === "array" && config.itemConfig) {
        const itemConfig = config.itemConfig as FieldConfig<unknown>;
        return createFieldBuilder({
          ...config,
          delimiter: separator,
          serialize: (value: T) => {
            if (!Array.isArray(value)) return "";
            return value
              .map((item) => itemConfig.serialize(item))
              .join(separator);
          },
          parse: (str: string) => {
            if (!str) return config.defaultValue;
            const items = str.split(separator);
            const parsed = items
              .map((item) => itemConfig.parse(item))
              .filter(
                (item): item is NonNullable<typeof item> => item !== null,
              );
            return parsed as T;
          },
        });
      }
      return createFieldBuilder({ ...config, delimiter: separator });
    },

    serialize(fn: (value: T) => string) {
      return createFieldBuilder({
        ...config,
        serialize: fn,
        hasCustomTransform: true,
      });
    },

    parse(fn: (value: string) => T | null) {
      return createFieldBuilder({
        ...config,
        parse: fn,
        hasCustomTransform: true,
      });
    },

    get _config() {
      return config;
    },
  };

  return builder;
}

// String field
function string(): FieldBuilder<string | null> {
  return createFieldBuilder<string | null>({
    type: "string",
    defaultValue: null,
    delimiter: "",
    serialize: (value) => (value === null ? "" : String(value)),
    parse: (str) => (str === "" ? null : str),
  });
}

// Number field (integer)
function number(): FieldBuilder<number | null> {
  return createFieldBuilder<number | null>({
    type: "number",
    defaultValue: null,
    delimiter: "",
    serialize: (value) => (value === null ? "" : String(value)),
    parse: (str) => {
      if (str === "") return null;
      const num = parseInt(str, 10);
      return isNaN(num) ? null : num;
    },
  });
}

// Boolean field
function boolean(): FieldBuilder<boolean | null> {
  return createFieldBuilder<boolean | null>({
    type: "boolean",
    defaultValue: null,
    delimiter: "",
    serialize: (value) => (value === null ? "" : String(value)),
    parse: (str) => {
      if (str === "") return null;
      if (str === "true") return true;
      if (str === "false") return false;
      return null;
    },
  });
}

// Timestamp field (Date)
function timestamp(): FieldBuilder<Date | null> {
  return createFieldBuilder<Date | null>({
    type: "timestamp",
    defaultValue: null,
    delimiter: "",
    serialize: (value) => (value === null ? "" : String(value.getTime())),
    parse: (str) => {
      if (str === "") return null;
      const time = parseInt(str, 10);
      if (isNaN(time)) return null;
      const date = new Date(time);
      return isNaN(date.getTime()) ? null : date;
    },
  });
}

// String literal field (enum-like)
function stringLiteral<T extends readonly string[]>(
  literals: T,
): FieldBuilder<T[number] | null> {
  return createFieldBuilder<T[number] | null>({
    type: "stringLiteral",
    defaultValue: null,
    delimiter: "",
    literals,
    serialize: (value) => (value === null ? "" : String(value)),
    parse: (str) => {
      if (str === "") return null;
      return literals.includes(str as T[number]) ? (str as T[number]) : null;
    },
  });
}

// Array field
function array<T>(itemBuilder: FieldBuilder<T>): FieldBuilder<T[]> {
  const itemConfig = itemBuilder._config;
  const defaultDelimiter =
    itemConfig.type === "number" ? SLIDER_DELIMITER : ARRAY_DELIMITER;

  return createFieldBuilder<T[]>({
    type: "array",
    defaultValue: [],
    delimiter: defaultDelimiter,
    itemConfig: itemConfig as FieldConfig<unknown>,
    serialize: (value) => {
      if (!Array.isArray(value) || value.length === 0) return "";
      return value
        .map((item) => itemConfig.serialize(item))
        .join(defaultDelimiter);
    },
    parse: (str) => {
      if (!str) return [];
      const items = str.split(defaultDelimiter);
      const parsed = items
        .map((item) => itemConfig.parse(item))
        .filter((item): item is T => item !== null);
      return parsed;
    },
  });
}

// Sort field { id: string, desc: boolean }
function sort(): FieldBuilder<{ id: string; desc: boolean } | null> {
  return createFieldBuilder<{ id: string; desc: boolean } | null>({
    type: "sort",
    defaultValue: null,
    delimiter: SORT_DELIMITER,
    serialize: (value) => {
      if (value === null) return "";
      return `${value.id}${SORT_DELIMITER}${value.desc ? "desc" : "asc"}`;
    },
    parse: (str) => {
      if (!str) return null;
      const [id, desc] = str.split(SORT_DELIMITER);
      if (!id) return null;
      return { id, desc: desc === "desc" };
    },
  });
}

// Export field builders
export const field = {
  string,
  number,
  boolean,
  timestamp,
  stringLiteral,
  array,
  sort,
};
