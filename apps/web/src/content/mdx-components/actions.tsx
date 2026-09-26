import React from "react";

import { APP_URL } from "@/lib/metadata/shared-metadata";

/** Adds `ref=<source>` to app links so OpenPanel can attribute the click. */
export function withRef(href: string, source: string) {
  if (!href.startsWith(APP_URL)) return href;
  const url = new URL(href);
  url.searchParams.set("ref", source);
  return url.toString();
}

/**
 * Row of `ButtonLink`s. `source` names the CTA slot (`home-hero`) and lands on
 * every app link in the row as `?ref=`. Injected via `cloneElement`, not
 * context: this renders on the server, where `createContext` is unavailable.
 */
export function Actions({
  source,
  children,
}: {
  source: string;
  children: React.ReactNode;
}) {
  return (
    <div className="not-prose my-4 flex flex-wrap items-center gap-2">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement<{ href?: string }>(child)) return child;
        const href = child.props.href;
        if (!href) return child;
        return React.cloneElement(child, { href: withRef(href, source) });
      })}
    </div>
  );
}
