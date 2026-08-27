export type PrimitiveType =
  | "string"
  | "number"
  | "boolean"
  | "timestamp"
  | "stringLiteral";

// Field configuration stored internally
export interface FieldConfig<T> {
  type: PrimitiveType | "array" | "sort";
  defaultValue: T;
  delimiter: string;
  serialize: (value: T) => string;
  parse: (value: string) => T | null;
  // For stringLiteral type
  literals?: readonly string[];
  // For array type
  itemConfig?: FieldConfig<unknown>;
}

// Field builder interface (fluent API)
export interface FieldBuilder<T> {
  /**
   * Set the default value for this field
   */
  default(value: T): FieldBuilder<T>;

  /**
   * Set the delimiter for serialization (used for arrays)
   */
  delimiter(separator: string): FieldBuilder<T>;

  /**
   * Custom serialization function
   */
  serialize(fn: (value: T) => string): FieldBuilder<T>;

  /**
   * Custom parse function
   */
  parse(fn: (value: string) => T | null): FieldBuilder<T>;

  /**
   * Internal config - do not use directly
   * @internal
   */
  readonly _config: FieldConfig<T>;
}

// Schema definition as a record of field builders

export type SchemaDefinition = Record<string, FieldBuilder<any>>;

// Infer the TypeScript type from a schema definition
export type InferSchemaType<T extends SchemaDefinition> = {
  [K in keyof T]: T[K] extends FieldBuilder<infer U> ? U : never;
};

// Schema object returned by createSchema
export interface Schema<T extends SchemaDefinition> {
  /**
   * The raw schema definition
   */
  readonly definition: T;

  /**
   * Get default values for all fields
   */
  readonly defaults: InferSchemaType<T>;

  /**
   * Inferred TypeScript type (for type inference only)
   */
  readonly _type: InferSchemaType<T>;
}

// Store snapshot with version for change detection
export interface StoreSnapshot<T> {
  state: T;
  version: number;
}

// Adapter options passed during creation
export interface AdapterOptions {
  /**
   * Unique ID for this table (required for multi-table support)
   */
  id: string;

  /**
   * Initial state to override defaults
   */
  initialState?: Record<string, unknown>;
}
