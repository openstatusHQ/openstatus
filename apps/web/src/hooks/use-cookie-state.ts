"use client";

import { useCallback, useEffect, useState } from "react";

export function useCookieState(name: string, defaultValue?: string) {
  const [state, setState] = useState<string>();

  const handleChange = useCallback(
    (value: string) => {
      if (document) {
        document.cookie = `${name}=${value}; path=/`;
        setState(value);
      }
    },
    [name],
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
      setState(cookie.split("=")[1]);
    }
  }, []);

  return [state, handleChange] as const;
}
