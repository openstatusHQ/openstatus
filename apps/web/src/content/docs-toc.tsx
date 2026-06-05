"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
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

export function TableOfContents({ items }: { items: TocItem[] }) {
  const active = useActiveHeading(items);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="py-2 font-medium font-mono text-foreground">On this page</p>
      <ul>
        {items.map((item) => (
          <li key={item.slug}>
            <a
              href={`#${item.slug}`}
              className={cn(
                "ease block py-2 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground motion-reduce:transition-none",
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
