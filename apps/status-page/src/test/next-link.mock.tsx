// Test double for next/link, swapped in via --import-map: Deno cannot resolve
// Next's extensionless CJS entrypoints. Renders a plain anchor.
import type * as React from "react";

type LinkProps = Omit<React.ComponentProps<"a">, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
};

function toHref(href: LinkProps["href"]) {
  if (typeof href === "string") return href;
  const query = new URLSearchParams(href.query).toString();
  return `${href.pathname ?? ""}${query ? `?${query}` : ""}`;
}

export default function Link({
  href,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  ...props
}: LinkProps) {
  return <a href={toHref(href)} {...props} />;
}
