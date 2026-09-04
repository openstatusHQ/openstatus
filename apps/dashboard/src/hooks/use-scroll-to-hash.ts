"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Settings pages render `null` until tRPC data resolves, so native hash scroll
// fires before the anchor exists. Retry via rAF until the element mounts.
function scrollWhenReady(id: string) {
  const start = performance.now();
  const tick = () => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView();
      return;
    }
    if (performance.now() - start < 2000) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

// Imperative helper for anchor menu items — handles same-page and repeat
// selection where the URL hash doesn't change and `hashchange` never fires.
export function scrollToHash(id: string) {
  scrollWhenReady(id);
}

export function useScrollToHash() {
  const pathname = usePathname();

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) scrollWhenReady(id);

    const onHashChange = () => {
      const next = window.location.hash.slice(1);
      if (next) scrollWhenReady(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname]);
}
