"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { TocItem } from "./toc";

export function TableOfContents({ items }: { items: TocItem[] }) {
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

  if (items.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="mb-3 font-medium text-foreground">On this page</p>
      <ul>
        {items.map((item) => (
          <li key={item.slug}>
            <a
              href={`#${item.slug}`}
              className={cn(
                "block py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
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
