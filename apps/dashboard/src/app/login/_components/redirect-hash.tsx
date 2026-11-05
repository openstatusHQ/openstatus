"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";

// The proxy's login redirect can't see `#section`; the browser keeps it on
// /login, so fold it into `redirectTo` before a provider takes over.
export function RedirectHash() {
  const [redirectTo, setRedirectTo] = useQueryState(
    "redirectTo",
    parseAsString.withOptions({ shallow: false }),
  );

  useEffect(() => {
    const { hash } = window.location;
    if (!redirectTo || !hash || redirectTo.includes("#")) return;
    void setRedirectTo(`${redirectTo}${hash}`);
  }, [redirectTo, setRedirectTo]);

  return null;
}
