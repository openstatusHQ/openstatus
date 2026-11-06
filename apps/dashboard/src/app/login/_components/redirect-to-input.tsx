"use client";

import { useEffect, useState } from "react";

// The proxy's login redirect can't see `#section`; the browser keeps it on
// /login, so append it here. A hidden field (not a URL update) means the
// value a form submits is never older than what's rendered.
export function RedirectToInput({ redirectTo }: { redirectTo?: string }) {
  const [value, setValue] = useState(redirectTo);

  useEffect(() => {
    const sync = () => {
      const { hash } = window.location;
      setValue(
        redirectTo && hash && !redirectTo.includes("#")
          ? `${redirectTo}${hash}`
          : redirectTo,
      );
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [redirectTo]);

  if (!value) return null;
  return <input type="hidden" name="redirectTo" value={value} />;
}
