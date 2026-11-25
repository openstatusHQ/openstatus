import type { InferSchemaType, SchemaDefinition } from "../schema/types";

/**
 * Options for creating a text parser
 */
export interface TextParserOptions {
  /**
   * Field aliases for shorthand (e.g., { l: 'level', r: 'regions' })
   */
  aliases?: Record<string, string>;

  /**
   * Delimiter between field:value pairs (default: ' ')
   */
  fieldDelimiter?: string;

  /**
   * Delimiter between field and value (default: ':')
   */
  keyValueDelimiter?: string;
}

/**
 * Text parser interface
 */
export interface TextParser<T extends SchemaDefinition> {
  /**
   * Parse a text input string into filter state
   *
   * @example
   * ```typescript
   * parser.parse('regions:ams,gru latency:0-1000');
   * // => { regions: ['ams', 'gru'], latency: [0, 1000] }
   * ```
   */
  parse(input: string): Partial<InferSchemaType<T>>;

  /**
   * Serialize filter state to text format
   *
   * @example
   * ```typescript
   * parser.serialize({ regions: ['ams', 'gru'], latency: [0, 1000] });
   * // => 'regions:ams,gru latency:0-1000'
   * ```
   */
  serialize(state: Partial<InferSchemaType<T>>): string;

  /**
   * Get the current word at caret position
   */
  getWordAtCaret(
    input: string,
    caretPosition: number,
  ): {
    word: string;
    start: number;
    end: number;
    field: string | null;
    value: string | null;
  };

  /**
   * Replace the current word at caret position
   */
  replaceWordAtCaret(
    input: string,
    caretPosition: number,
    replacement: string,
  ): {
    newInput: string;
    newCaretPosition: number;
  };

  /**
   * Get suggestions for autocomplete
   */
  getSuggestions(
    input: string,
    caretPosition: number,
    fieldOptions: Record<string, string[]>,
  ): {
    type: "field" | "value";
    field?: string;
    suggestions: string[];
  };
}
