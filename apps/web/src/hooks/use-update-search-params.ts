import { useSearchParams } from "next/navigation";
import * as React from "react";

export default function useUpdateSearchParams() {
  const searchParams = useSearchParams();

  /**
   * Get a new searchParams string by merging the current searchParams with a provided key/value pair.
   * If param is `null`, will be deleted.
   */
  const update = React.useCallback(
    (
      params: Record<
        string,
        boolean | string | number | boolean[] | string[] | number[] | null
      >,
    ) => {
      const newSearchParams = new URLSearchParams(searchParams?.toString());

      for (const [key, value] of Object.entries(params)) {
        if (value === null) {
          newSearchParams.delete(key);
        } else {
          if (Array.isArray(value)) {
            newSearchParams.delete(key);
            for (const v of value) {
              // REMINDER: cant pass an array directly but can use several time `append`
              newSearchParams.append(key, String(v));
            }
          } else {
            // REMINDER: .set will automatically encodeURIComponent
            newSearchParams.set(key, String(value));
          }
        }
      }

      return newSearchParams.toString();
    },
    [searchParams],
  );

  return update;
}
