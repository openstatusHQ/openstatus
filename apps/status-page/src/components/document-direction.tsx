"use client";

import { useEffect } from "react";

/**
 * Mirrors the active locale onto `<html>`. The root layout renders
 * `lang="en"` because it sits above the locale segment, and popovers,
 * dropdowns and toasts portal to `<body>`, outside the locale wrapper.
 */
export function DocumentDirection({
  lang,
  dir,
}: {
  lang: string;
  dir: "ltr" | "rtl";
}) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = { lang: root.lang, dir: root.dir };
    root.lang = lang;
    root.dir = dir;
    return () => {
      root.lang = previous.lang;
      root.dir = previous.dir;
    };
  }, [lang, dir]);

  return null;
}
