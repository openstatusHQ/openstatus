"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

function highlight(root: HTMLElement, query: string) {
  if (!query) return;

  const regex = new RegExp(`(${query})`, "gi");
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
    if (!nodeValue || !regex.test(nodeValue)) continue;

    const span = document.createElement("span");
    span.innerHTML = nodeValue.replace(regex, "<mark>$1</mark>");

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
