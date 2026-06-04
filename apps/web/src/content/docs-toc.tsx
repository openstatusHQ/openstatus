"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import type { TocItem } from "./toc";

function useActiveHeading(items: TocItem[]) {
  const [active, setActive] = useState<string>();

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    for (const { slug } of items) {
      const el = document.getElementById(slug);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return active;
}

// ─── Option A: Flat (current) ───────────────────────────────────────────────

function TocA({ items, active }: { items: TocItem[]; active?: string }) {
  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="mb-3 font-medium text-foreground">On this page</p>
      <ul>
        {items.map((item) => (
          <li key={item.slug}>
            <a
              href={`#${item.slug}`}
              className={cn(
                "block py-2 text-muted-foreground transition-colors duration-150 ease hover:bg-muted hover:text-foreground motion-reduce:transition-none",
                item.depth === 2 ? "pl-2" : "pl-4",
                active === item.slug && "bg-muted text-foreground",
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ─── Option B: Sliding border track ─────────────────────────────────────────
// A vertical border with a highlight segment that visually slides to the
// active heading. Uses a CSS custom property on the <ul> to position a
// pseudo-element at the active item's offset.

function TocB({ items, active }: { items: TocItem[]; active?: string }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [marker, setMarker] = useState({ top: 0, height: 0 });

  useEffect(() => {
    if (!active || !listRef.current) return;
    const activeEl = listRef.current.querySelector(
      `[data-toc-slug="${active}"]`,
    ) as HTMLElement | null;
    if (!activeEl) return;
    const listRect = listRef.current.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    setMarker({
      top: elRect.top - listRect.top,
      height: elRect.height,
    });
  }, [active]);

  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <div className="relative">
        <div className="absolute top-0 left-0 bottom-0 w-px bg-border" />
        <div
          className="absolute left-0 w-px bg-foreground transition-all duration-200 ease-out motion-reduce:transition-none"
          style={{ top: marker.top, height: marker.height }}
        />
        <ul ref={listRef}>
          {items.map((item) => (
            <li key={item.slug}>
              <a
                href={`#${item.slug}`}
                data-toc-slug={item.slug}
                className={cn(
                  "block py-1.5 text-muted-foreground transition-colors duration-150 ease hover:text-foreground motion-reduce:transition-none",
                  item.depth === 2 ? "pl-3" : "pl-5",
                  active === item.slug && "text-foreground",
                )}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// ─── Option C: Numbered sections ────────────────────────────────────────────
// Each h2 gets an auto-incrementing number, h3s indent without a number.
// The number transitions from muted to foreground when active.

function TocC({ items, active }: { items: TocItem[]; active?: string }) {
  let h2Index = 0;
  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ul className="flex flex-col">
        {items.map((item) => {
          const isH2 = item.depth === 2;
          if (isH2) h2Index++;
          return (
            <li key={item.slug}>
              <a
                href={`#${item.slug}`}
                className={cn(
                  "group flex items-baseline gap-2.5 py-1.5 text-muted-foreground transition-colors duration-150 ease hover:text-foreground motion-reduce:transition-none",
                  !isH2 && "ml-7",
                  active === item.slug && "text-foreground",
                )}
              >
                {isH2 ? (
                  <span
                    className={cn(
                      "w-4 shrink-0 text-right tabular-nums text-xs text-muted-foreground/50 transition-colors duration-150 ease group-hover:text-muted-foreground motion-reduce:transition-none",
                      active === item.slug && "text-foreground/60",
                    )}
                  >
                    {String(h2Index).padStart(2, "0")}
                  </span>
                ) : null}
                <span>{item.text}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── Option D: Minimal fade ────────────────────────────────────────────────
// No indicators at all. Inactive items are heavily faded, active item is
// full contrast. The contrast change IS the indicator. Cleanest possible.

function TocD({ items, active }: { items: TocItem[]; active?: string }) {
  const hasActive = active != null;
  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ul className="flex flex-col">
        {items.map((item) => {
          const isActive = active === item.slug;
          return (
            <li key={item.slug}>
              <a
                href={`#${item.slug}`}
                className={cn(
                  "block py-1.5 transition-colors duration-200 ease hover:text-foreground motion-reduce:transition-none",
                  item.depth > 2 && "ml-3",
                  isActive
                    ? "text-foreground"
                    : hasActive
                      ? "text-muted-foreground/40"
                      : "text-muted-foreground",
                )}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── Picker-wrapped export ──────────────────────────────────────────────────

export function TableOfContents({ items }: { items: TocItem[] }) {
  const active = useActiveHeading(items);

  if (items.length === 0) return null;

  return (
    <div data-uidotsh-pick="TOC style" className="contents">
      <div data-uidotsh-option="Flat (current)" className="contents">
        <TocA items={items} active={active} />
      </div>
      <div
        data-uidotsh-option="Sliding border track"
        className="contents"
        hidden
      >
        <TocB items={items} active={active} />
      </div>
      <div data-uidotsh-option="Numbered sections" className="contents" hidden>
        <TocC items={items} active={active} />
      </div>
      <div data-uidotsh-option="Minimal fade" className="contents" hidden>
        <TocD items={items} active={active} />
      </div>
    </div>
  );
}
