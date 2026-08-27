import { experimental_useObject as useObject } from "@ai-sdk/react";
import {
  diffPartialState,
  generateAIOutputSchema,
  isStructuredQuery,
  parseAIResponse,
} from "@openstatus/ui/lib/data-table-filters/ai/index";
import type { TableSchemaDefinition } from "@openstatus/ui/lib/data-table-filters/table-schema/index";
import { useCallback, useEffect, useMemo, useRef } from "react";

export type UseAIFiltersOptions = {
  /** The API endpoint that streams AI filter results */
  api: string;
  /** Table schema definition for generating the output schema and detecting structured queries */
  tableSchema: TableSchemaDefinition;
  /** Called for each progressively completed field */
  onField: (key: string, value: unknown) => void;
  /** Called with the final validated state on stream end */
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

  const { submit, object, isLoading, error } = useObject({
    api,
    schema: outputSchema,
    onFinish({ object }) {
      prevRef.current = {};
      if (object) {
        const validated = parseAIResponse(
          tableSchema,
          object as Record<string, unknown>,
        );
        if (validated) {
          onFinish(validated);
        }
      }
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
      submit({ query: trimmed });
      return true;
    },
    [submit, tableSchema, onStart],
  );

  return { infer, isLoading, error };
}
