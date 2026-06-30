"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { buildHighlightRegex } from "@/content/utils/search-match";

function escapeHtml(input: string) {
  return input.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );
}

function highlight(root: HTMLElement, query: string) {
  const regex = buildHighlightRegex(query);
  if (!regex) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

  const textNodes: Text[] = [];
  let node = walker.nextNode();

  while (node) {
    if (node instanceof Text) {
      textNodes.push(node);
    }
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const nodeValue = textNode.nodeValue;
    // `g`-flag .test is stateful — reset so a hit in one node can't skip the next.
    regex.lastIndex = 0;
    if (!nodeValue || !regex.test(nodeValue)) continue;

    const span = document.createElement("span");
    // Escape first — the text node's value must not parse as HTML.
    span.innerHTML = escapeHtml(nodeValue).replace(
      regex,
      (match) => `<mark>${match}</mark>`,
    );

    textNode.parentNode?.replaceChild(span, textNode);
  }
}

export function HighlightText({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const q = searchParams.get("q");

  useEffect(() => {
    if (ref.current && q) {
      highlight(ref.current, q);
    }
  }, [q]);

  return <div ref={ref}>{children}</div>;
}
