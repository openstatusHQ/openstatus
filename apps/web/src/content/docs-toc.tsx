"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import type { TocItem } from "./toc";

function useActiveHeading(items: TocItem[]) {
  const [active, setActive] = useState<string>();

  useEffect(() => {
    if (items.length === 0) return;
    const visible = new Set<string>();
    const update = () => {
      const firstVisible = items.find((i) => visible.has(i.slug));
      if (firstVisible) {
        setActive(firstVisible.slug);
        return;
      }
      // Nothing in the activation band (e.g. scrolled past the last heading):
      // fall back to the last heading already scrolled above it.
      let aboveBand: string | undefined;
      for (const { slug } of items) {
        const el = document.getElementById(slug);
        if (el && el.getBoundingClientRect().top < 0) aboveBand = slug;
      }
      setActive(aboveBand);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        update();
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

export function TableOfContents({ items }: { items: TocItem[] }) {
  const active = useActiveHeading(items);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="text-foreground py-2 font-mono font-medium">On this page</p>
      <ul>
        {items.map((item) => (
          <li key={item.slug}>
            <a
              href={`#${item.slug}`}
              className={cn(
                "ease text-muted-foreground hover:bg-muted hover:text-foreground block py-2 transition-colors duration-150 motion-reduce:transition-none",
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
