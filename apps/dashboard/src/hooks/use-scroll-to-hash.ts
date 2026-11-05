"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Reflow between remove/set restarts the animation on repeat selection.
function highlight(el: HTMLElement) {
  el.removeAttribute("data-hash-target");
  void el.offsetWidth;
  el.setAttribute("data-hash-target", "");
  // Descendant animations bubble `animationend`; only ours ends the ring.
  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.animationName !== "hash-target") return;
    el.removeAttribute("data-hash-target");
    el.removeEventListener("animationend", onAnimationEnd);
  };
  el.addEventListener("animationend", onAnimationEnd);
}

function reveal(el: HTMLElement) {
  el.scrollIntoView();
  highlight(el);
}

// Pages render `null` until tRPC data resolves, so native hash scroll fires
// before the anchor exists, and hydration can swap the node right after.
// Watch the DOM until the target settles: 10s to appear, then the 2s ring.
function scrollWhenReady(id: string) {
  let current: HTMLElement | null = null;
  let timeout = 0;
  const observer = new MutationObserver(() => check());
  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timeout);
  };
  const check = () => {
    const el = document.getElementById(id);
    if (!el || el === current) return;
    const first = current === null;
    current = el;
    reveal(el);
    if (first) {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(stop, 2000);
    }
  };
  timeout = window.setTimeout(stop, 10_000);
  observer.observe(document.body, { childList: true, subtree: true });
  check();
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
    // A click on the current hash fires no `hashchange`; replay it here.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor?.hash || anchor.hash !== window.location.hash) return;
      if (anchor.pathname !== window.location.pathname) return;
      scrollWhenReady(anchor.hash.slice(1));
    };
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onClick);
    };
  }, [pathname]);
}

/** Mounted once in the root layout so every route gets hash scrolling. */
export function ScrollToHash() {
  useScrollToHash();
  return null;
}
