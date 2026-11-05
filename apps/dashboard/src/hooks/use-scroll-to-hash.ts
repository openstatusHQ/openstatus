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

// One watcher at a time: a newer navigation (or a cleared hash) must not let
// an older, still-pending target scroll the page when it finally mounts.
let cancelActive: (() => void) | null = null;

function cancelScroll() {
  cancelActive?.();
  cancelActive = null;
}

// Pages render `null` until tRPC data resolves, so native hash scroll fires
// before the anchor exists, and hydration can swap the node right after.
// Watch the DOM until the target settles: 10s to appear, then the 2s ring.
// With `pathname`, ids on the page being left (same section, other incident)
// are ignored until the URL has moved to the destination.
function scrollWhenReady(id: string, pathname?: string) {
  cancelScroll();
  let current: HTMLElement | null = null;
  let timeout = 0;
  const observer = new MutationObserver(() => check());
  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timeout);
    if (cancelActive === stop) cancelActive = null;
  };
  const check = () => {
    if (pathname && window.location.pathname !== pathname) return;
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
  cancelActive = stop;
  timeout = window.setTimeout(stop, 10_000);
  observer.observe(document.body, { childList: true, subtree: true });
  check();
}

// Imperative helper for anchor menu items — handles same-page and repeat
// selection where the URL hash doesn't change and `hashchange` never fires.
// Takes the full href so a cross-page jump waits for the destination page.
export function scrollToHash(href: string) {
  const url = new URL(href, window.location.href);
  const id = url.hash.slice(1);
  if (id) scrollWhenReady(id, url.pathname);
}

function isPlainClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function useScrollToHash() {
  const pathname = usePathname();

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) scrollWhenReady(id, window.location.pathname);

    const onHashChange = () => {
      const next = window.location.hash.slice(1);
      if (next) scrollWhenReady(next, window.location.pathname);
      else cancelScroll();
    };
    // A click on the current hash fires no `hashchange`; replay it here.
    // Modified clicks open a new tab or window and leave this page alone.
    const onClick = (event: MouseEvent) => {
      if (!isPlainClick(event)) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor?.hash || anchor.hash !== window.location.hash) return;
      if (anchor.pathname !== window.location.pathname) return;
      scrollWhenReady(anchor.hash.slice(1), anchor.pathname);
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
