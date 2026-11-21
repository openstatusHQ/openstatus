"use client";

import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import "./picker.css";
import { Disclosure } from "./variants/disclosure";
import { Inline } from "./variants/inline";
import { Proof } from "./variants/proof";
import { Segmented } from "./variants/segmented";
import { Tiered } from "./variants/tiered";

const variants = [
  { name: "Inline", Component: Inline },
  { name: "Tiered", Component: Tiered },
  { name: "Segmented", Component: Segmented },
  { name: "Disclosure", Component: Disclosure },
  { name: "Proof", Component: Proof },
];

export function Harness({
  title,
  hero,
  description,
  demo,
  initial,
}: {
  initial: number;
  title: string;
  hero: string;
  description: string;
  demo: React.ReactNode;
}) {
  const [current, setCurrent] = useState(
    initial >= 1 && initial <= variants.length ? initial - 1 : 0,
  );
  const [ready, setReady] = useState(false);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const highlight = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setReady(true)),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  useLayoutEffect(() => {
    const move = () => {
      const el = items.current[current];
      if (!el || !highlight.current) return;
      highlight.current.style.width = `${el.offsetWidth}px`;
      highlight.current.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [current]);

  const select = (i: number) => {
    if (i < 0 || i >= variants.length) return;
    setCurrent(i);
    const url = new URL(location.href);
    url.searchParams.set("v", String(i + 1));
    history.replaceState(null, "", url);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= variants.length) select(num - 1);
      else if (e.key === "ArrowRight") select((current + 1) % variants.length);
      else if (e.key === "ArrowLeft")
        select((current - 1 + variants.length) % variants.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current]);

  const { Component } = variants[current];

  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>{hero}</h1>
      <p>{description}</p>
      <Component key={current} title={title} />
      {demo}
      <nav
        className="proto-picker"
        aria-label="Prototype variants"
        data-ready={ready ? "" : undefined}
      >
        <span
          className="proto-picker-highlight"
          aria-hidden="true"
          ref={highlight}
        />
        {variants.map(({ name }, i) => (
          <button
            key={name}
            type="button"
            ref={(el) => {
              items.current[i] = el;
            }}
            className="proto-picker-item"
            data-active={i === current ? "" : undefined}
            aria-current={i === current ? "true" : undefined}
            onClick={() => select(i)}
          >
            {name}
          </button>
        ))}
      </nav>
    </div>
  );
}
