import { experimental_useObject as useObject } from "@ai-sdk/react";
import {
  diffPartialState,
  generateAIOutputSchema,
  isStructuredQuery,
  parseAIResponse,
} from "@openstatus/ui/lib/data-table-filters/ai/index";
import {
  serializeSchema,
  type TableSchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";
import { useCallback, useEffect, useMemo, useRef } from "react";

export type UseAIFiltersOptions = {
  /** The API endpoint that streams AI filter results */
  api: string;
  /** Table schema definition for generating the output schema and detecting structured queries */
  tableSchema: TableSchemaDefinition;
  /** Called for each progressively completed field */
  onField: (key: string, value: unknown) => void;
  /**
   * Called with the final validated state on stream end. Fields absent from the
   * state did not survive validation and must be cleared by the consumer.
   */
  onFinish: (state: Record<string, unknown>) => void;
  /** Called when the AI call fails */
  onError?: (error: Error) => void;
  /** Called before AI filters are applied — use to reset existing filters */
  onStart?: () => void;
  /** Called when the stream ends, regardless of validation success — use for cleanup */
  onComplete?: () => void;
};

export function useAIFilters({
  api,
  tableSchema,
  onField,
  onFinish,
  onError,
  onStart,
  onComplete,
}: UseAIFiltersOptions) {
  const prevRef = useRef<Record<string, unknown>>({});
  const outputSchema = useMemo(
    () => generateAIOutputSchema(tableSchema),
    [tableSchema],
  );
  // Sent with the request so the server builds its prompt and output schema from
  // the very schema this table filters on, not a generic stand-in.
  const serializedSchema = useMemo(
    () => serializeSchema(tableSchema),
    [tableSchema],
  );

  const { submit, object, isLoading, error } = useObject({
    api,
    schema: outputSchema,
    onFinish({ object, error }) {
      prevRef.current = {};
      // The final object failing the output schema is a failed request, not an
      // empty result — leave the table to the error path so it can be restored.
      if (error) {
        onComplete?.();
        onError?.(error);
        return;
      }
      // Always reconcile, even with nothing valid: progressive updates already
      // touched the table and the consumer has to clear what did not survive.
      onFinish(
        parseAIResponse(
          tableSchema,
          (object ?? {}) as Record<string, unknown>,
        ) ?? {},
      );
      onComplete?.();
    },
    onError(error) {
      onComplete?.();
      onError?.(error);
    },
  });

  // Progressive application via diffPartialState
  useEffect(() => {
    if (!object) return;
    const next = object as Record<string, unknown>;
    const completed = diffPartialState(prevRef.current, next, tableSchema);
    for (const { key, value } of completed) {
      onField(key, value);
    }
    prevRef.current = { ...next };
  }, [object]); // eslint-disable-line react-hooks/exhaustive-deps

  const infer = useCallback(
    (query: string): boolean => {
      if (isStructuredQuery(query, tableSchema)) return false;
      const trimmed = query.trim();
      if (!trimmed) return false;

      onStart?.();
      prevRef.current = {};
      submit({ query: trimmed, schema: serializedSchema });
      return true;
    },
    [submit, tableSchema, onStart, serializedSchema],
  );

  return { infer, isLoading, error };
}
