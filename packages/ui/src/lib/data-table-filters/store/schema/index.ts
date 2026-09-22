import { getSchemaDefaults } from "./serialization";
import type { InferSchemaType, Schema, SchemaDefinition } from "./types";

/**
 * Schema System for BYOS (Bring Your Own Store)
 *
 * Provides a fluent API for defining filter schemas with type inference.
 *
 * @example
 * ```typescript
 * import { createSchema, field } from '@openstatus/ui/lib/data-table-filters/store/schema';
 *
 * const schema = createSchema({
 *   regions: field.array(field.string()).default([]).delimiter(','),
 *   latency: field.array(field.number()).delimiter('-'),
 *   host: field.string().default(''),
 *   live: field.boolean().default(false),
 * });
 *
 * type FilterState = typeof schema._type;
 * ```
 */

export { field } from "./field";
export type {
  FieldBuilder,
  FieldConfig,
  SchemaDefinition,
  InferSchemaType,
  Schema,
  StoreSnapshot,
  AdapterOptions,
} from "./types";
export {
  getSchemaDefaults,
  serializeState,
  parseState,
  validateState,
  mergeWithDefaults,
  isStateEqual,
  stateToSearchString,
} from "./serialization";

/**
 * Create a schema from field definitions
 *
 * @param definition - Object mapping field names to field builders
 * @returns Schema object with definition, defaults, and type inference
 *
 * @example
 * ```typescript
 * const schema = createSchema({
 *   level: field.array(field.stringLiteral(['error', 'warn', 'info'])).default([]),
 *   latency: field.array(field.number()).delimiter('-'),
 *   host: field.string(),
 * });
 * ```
 */
export function createSchema<T extends SchemaDefinition>(
  definition: T,
): Schema<T> {
  const defaults = getSchemaDefaults(definition);

  return {
    definition,
    defaults,
    // This is a type-only property for inference
    _type: defaults,
  };
}
