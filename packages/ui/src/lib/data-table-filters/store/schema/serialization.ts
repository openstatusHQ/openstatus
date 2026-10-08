import type { FieldBuilder, InferSchemaType, SchemaDefinition } from "./types";

/**
 * Get default values from a schema definition
 */
export function getSchemaDefaults<T extends SchemaDefinition>(
  schema: T,
): InferSchemaType<T> {
  const defaults: Record<string, unknown> = {};

  for (const [key, fieldBuilder] of Object.entries(schema)) {
    defaults[key] = fieldBuilder._config.defaultValue;
  }

  return defaults as InferSchemaType<T>;
}

/**
 * Serialize state to a string map (for URL params or storage)
 */
export function serializeState<T extends SchemaDefinition>(
  schema: T,
  state: Partial<InferSchemaType<T>>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(state)) {
    const fieldBuilder = schema[key] as FieldBuilder<unknown> | undefined;
    if (!fieldBuilder) continue;

    const serialized = fieldBuilder._config.serialize(value);
    if (serialized !== "") {
      result[key] = serialized;
    }
  }

  return result;
}

/**
 * Parse a string map back to state
 */
export function parseState<T extends SchemaDefinition>(
  schema: T,
  stringMap: Record<string, string | string[] | undefined>,
): Partial<InferSchemaType<T>> {
  const result: Record<string, unknown> = {};

  for (const [key, fieldBuilder] of Object.entries(schema)) {
    const rawValue = stringMap[key];
    if (rawValue === undefined) continue;

    // Handle array values from URL (Next.js can pass arrays)
    const strValue = Array.isArray(rawValue) ? rawValue.join(",") : rawValue;

    const parsed = (fieldBuilder as FieldBuilder<unknown>)._config.parse(
      strValue,
    );
    if (parsed !== null) {
      result[key] = parsed;
    }
  }

  return result as Partial<InferSchemaType<T>>;
}

/**
 * Validate and coerce state, returning defaults for invalid values
 */
export function validateState<T extends SchemaDefinition>(
  schema: T,
  state: unknown,
): InferSchemaType<T> {
  const defaults = getSchemaDefaults(schema);

  if (!state || typeof state !== "object") {
    return defaults;
  }

  const result: Record<string, unknown> = { ...defaults };

  for (const [key, fieldBuilder] of Object.entries(schema)) {
    const value = (state as Record<string, unknown>)[key];
    if (value === undefined) continue;

    // Serialize and re-parse to validate
    const config = (fieldBuilder as FieldBuilder<unknown>)._config;
    const serialized = config.serialize(value);
    const parsed = config.parse(serialized);

    if (parsed !== null) {
      result[key] = parsed;
    }
    // If invalid, default is already in result
  }

  return result as InferSchemaType<T>;
}

/**
 * Merge partial state with defaults
 */
export function mergeWithDefaults<T extends SchemaDefinition>(
  schema: T,
  partial: Partial<InferSchemaType<T>>,
): InferSchemaType<T> {
  const defaults = getSchemaDefaults(schema);
  return { ...defaults, ...partial };
}

/**
 * Check if two states are equal (shallow comparison for primitives, deep for arrays)
 */
export function isStateEqual<T extends Record<string, unknown>>(
  a: T,
  b: T,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    const valA = a[key];
    const valB = b[key];

    if (valA === valB) continue;

    // Handle arrays
    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (valA.length !== valB.length) return false;
      for (let i = 0; i < valA.length; i++) {
        const itemA = valA[i];
        const itemB = valB[i];
        if (itemA instanceof Date && itemB instanceof Date) {
          if (itemA.getTime() !== itemB.getTime()) return false;
        } else if (itemA !== itemB) {
          return false;
        }
      }
      continue;
    }

    // Handle dates
    if (valA instanceof Date && valB instanceof Date) {
      if (valA.getTime() !== valB.getTime()) return false;
      continue;
    }

    // Handle objects (sort field)
    if (
      valA !== null &&
      valB !== null &&
      typeof valA === "object" &&
      typeof valB === "object"
    ) {
      const objA = valA as Record<string, unknown>;
      const objB = valB as Record<string, unknown>;
      if (!isStateEqual(objA, objB)) return false;
      continue;
    }

    return false;
  }

  return true;
}

/**
 * Create a URL search string from state
 */
export function stateToSearchString<T extends SchemaDefinition>(
  schema: T,
  state: Partial<InferSchemaType<T>>,
): string {
  const serialized = serializeState(schema, state);
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(serialized)) {
    if (value) {
      params.set(key, value);
    }
  }

  const str = params.toString();
  return str ? `?${str}` : "";
}
