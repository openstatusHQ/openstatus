"use client";

import { useParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";

import { createProtectedCookieKey } from "@/lib/protected";

export function PasswordWrapper({ children }: { children?: React.ReactNode }) {
  const [password, setPassword] = useQueryState("pw", parseAsString);
  const { domain } = useParams<{ domain: string }>();

  useEffect(() => {
    if (password) {
      const key = createProtectedCookieKey(domain);
      document.cookie = `${key}=${password}; path=/; expires=${new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 30,
      ).toUTCString()}`;
      void setPassword(null);
    }
  }, [password, domain, setPassword]);

  return children;
}
