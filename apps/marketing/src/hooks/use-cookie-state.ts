"use client";

import { useCallback, useEffect, useState } from "react";

export function useCookieState<T extends string>(
  name: string,
  defaultValue?: T,
  config?: { expires?: number },
) {
  const [state, setState] = useState<T>();

  const handleChange = useCallback(
    (value: T) => {
      if (document) {
        const date = new Date();
        date.setTime(date.getTime() + 365 * 24 * 60 * 60 * 1000); // in one year
        document.cookie = `${name}=${value}; path=/; expires=${
          config?.expires ?? date.toUTCString()
        }`;
        setState(value);
      }
    },
    [name, config],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (document) {
      const cookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith(name));
      if (!cookie) {
        setState(defaultValue);
        return;
      }
      const value = cookie.split("=")[1] as T;
      setState(value);
    }
  }, []);

  return [state, handleChange] as const;
}
