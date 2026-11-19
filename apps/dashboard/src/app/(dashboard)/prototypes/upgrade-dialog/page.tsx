"use client";

import { useCookieState } from "@openstatus/ui/hooks/use-cookie-state";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Client as StatusPagesList } from "../../status-pages/(list)/client";

import "./picker.css";
import { TRIGGERS, type VariantProps } from "./shared";
import { VariantOnePlan } from "./variant-one-plan";
import { VariantPinnedRow } from "./variant-pinned-row";
import { VariantPlanCards } from "./variant-plan-cards";

const VARIANTS: {
  name: string;
  Component: (props: VariantProps) => React.ReactNode;
}[] = [
  { name: "Pinned row", Component: VariantPinnedRow },
  { name: "Plan cards", Component: VariantPlanCards },
  { name: "One plan", Component: VariantOnePlan },
];

export default function Page() {
  const [v, setV] = useQueryState("v", parseAsInteger.withDefault(1));
  const [from, setFrom] = useQueryState(
    "from",
    parseAsString.withDefault(TRIGGERS[0].value),
  );
  const [currency] = useCookieState("x-currency", "USD");
  const [mountKey, setMountKey] = useState(0);
  const [open, setOpen] = useState(true);
  const pickerRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const current = v >= 1 && v <= VARIANTS.length ? v - 1 : 0;
  const trigger = TRIGGERS.find((item) => item.value === from) ?? TRIGGERS[0];
  const { Component } = VARIANTS[current];

  function remount() {
    setOpen(true);
    setMountKey((key) => key + 1);
  }

  function setActive(index: number) {
    void setV(index + 1);
    remount();
  }

  useLayoutEffect(() => {
    function moveHighlight() {
      const el = itemRefs.current[current];
      const highlight = highlightRef.current;
      if (!el || !highlight) return;
      highlight.style.width = `${el.offsetWidth}px`;
      highlight.style.transform = `translateX(${el.offsetLeft}px)`;
    }
    moveHighlight();
    window.addEventListener("resize", moveHighlight);
    return () => window.removeEventListener("resize", moveHighlight);
  }, [current]);

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        pickerRef.current?.setAttribute("data-ready", ""),
      ),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const num = Number.parseInt(event.key, 10);
      if (num >= 1 && num <= VARIANTS.length) setActive(num - 1);
      else if (event.key === "ArrowRight") {
        setActive((current + 1) % VARIANTS.length);
      } else if (event.key === "ArrowLeft") {
        setActive((current - 1 + VARIANTS.length) % VARIANTS.length);
      } else if (event.key === "r" || event.key === "R") remount();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <>
      <StatusPagesList />
      {open ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" />
          <Component
            key={`${current}-${trigger.value}-${mountKey}`}
            limit={trigger.limit}
            currency={currency || "USD"}
            onClose={() => setOpen(false)}
          />
        </>
      ) : null}
      <label
        data-proto-chrome
        className="fixed top-4 left-1/2 z-[2147483647] flex -translate-x-1/2 items-center gap-2 rounded-full bg-neutral-950/80 py-1 pr-1 pl-3 font-sans text-[13px] text-white/60 backdrop-blur"
      >
        Opened from
        <select
          value={trigger.value}
          onChange={(event) => {
            void setFrom(event.target.value);
            remount();
          }}
          className="h-7 rounded-full bg-white/10 px-2 text-white outline-none"
        >
          {TRIGGERS.map((item) => (
            <option key={item.value} value={item.value} className="text-black">
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <nav
        ref={pickerRef}
        className="proto-picker"
        aria-label="Prototype variants"
      >
        <span
          ref={highlightRef}
          className="proto-picker-highlight"
          aria-hidden="true"
        />
        {VARIANTS.map((variant, index) => (
          <button
            key={variant.name}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            className="proto-picker-item"
            data-active={index === current ? "" : undefined}
            aria-current={index === current ? "true" : undefined}
            onClick={() => setActive(index)}
          >
            {variant.name}
          </button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true" />
        <button
          type="button"
          className="proto-picker-item proto-picker-replay"
          aria-label="Replay animation (R)"
          onClick={remount}
        >
          ↻
        </button>
      </nav>
    </>
  );
}
