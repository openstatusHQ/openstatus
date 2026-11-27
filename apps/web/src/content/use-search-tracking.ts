"use client";

import { useOpenPanel } from "@openpanel/nextjs";
import { Events } from "@openstatus/analytics/src/events";
import * as React from "react";

import type { Corpus, SearchResult } from "./search-meta";

const SETTLE_MS = 1000;
const MAX_QUERY_LENGTH = 100;

type Scope = Corpus | "all";

export function performedProps(
  query: string,
  scope: Scope,
  items: SearchResult[],
) {
  return {
    query: query.slice(0, MAX_QUERY_LENGTH),
    scope,
    results: items.length,
    full_results: items.filter((i) => i.tier === "full").length,
  };
}

export function clickedProps(
  query: string,
  scope: Scope,
  items: SearchResult[],
  item: SearchResult,
  top: boolean,
) {
  return {
    query: query.slice(0, MAX_QUERY_LENGTH),
    scope,
    // The href carries `?q=` for the on-page highlighter; the query is its own prop.
    href: item.href.replace(/\?q=[^#]*/, ""),
    type: item.type,
    tier: item.tier,
    rank: items.indexOf(item) + 1,
    top,
  };
}

// One `search_performed` per query the visitor paused on or clicked through,
// not one per keystroke. `settled` means `items` belong to `query`.
export function useSearchTracking({
  query,
  scope,
  items,
  settled,
}: {
  query: string;
  scope: Scope | null;
  items: SearchResult[];
  settled: boolean;
}) {
  const { track } = useOpenPanel();
  const tracked = React.useRef<string | null>(null);

  const performed = React.useCallback(() => {
    if (!query || !scope || !settled) return;
    const key = `${scope}:${query}`;
    if (tracked.current === key) return;
    tracked.current = key;
    track(Events.SearchPerformed.name, performedProps(query, scope, items));
  }, [query, scope, items, settled, track]);

  React.useEffect(() => {
    if (!query) tracked.current = null;
    const timer = setTimeout(performed, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [query, performed]);

  return React.useCallback(
    (item: SearchResult, top: boolean) => {
      if (!query || !scope) return;
      performed();
      track(
        Events.SearchResultClicked.name,
        clickedProps(query, scope, items, item, top),
      );
    },
    [query, scope, items, performed, track],
  );
}
