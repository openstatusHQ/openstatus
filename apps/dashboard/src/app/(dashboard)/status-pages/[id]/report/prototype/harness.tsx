"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Section, SectionGroup } from "@/components/content/section";
import type { UptimeMode } from "@/data/uptime-calculation.client";
import { useTRPC } from "@/lib/trpc/client";

import { Client } from "../client";
import type { VariantProps } from "./content";

import "./picker.css";
import { Example } from "./variants/example";
import { Ledger } from "./variants/ledger";
import { Sentence } from "./variants/sentence";

const VARIANTS: { name: string; Component: React.FC<VariantProps> }[] = [
  { name: "Sentence", Component: Sentence },
  { name: "Worked example", Component: Example },
  { name: "Ledger", Component: Ledger },
];

const MODES: UptimeMode[] = ["requests", "runs", "duration", "manual"];

export function Harness() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: history } = useQuery({
    ...trpc.page.getUptimeHistory.queryOptions({ id: Number.parseInt(id) }),
    enabled: workspace?.limits["uptime-history"] === true,
  });

  const searchParams = useSearchParams();
  const [current, setCurrent] = useState(() => {
    const v = Number.parseInt(searchParams.get("v") ?? "", 10);
    return v >= 1 && v <= VARIANTS.length ? v - 1 : 0;
  });
  const modeParam = searchParams.get("mode") as UptimeMode | null;
  const modeOverride =
    modeParam && MODES.includes(modeParam) ? modeParam : null;
  const [ready, setReady] = useState(false);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
  }, []);

  useLayoutEffect(() => {
    const move = () => {
      const el = itemRefs.current[current];
      const hl = highlightRef.current;
      if (!el || !hl) return;
      hl.style.width = `${el.offsetWidth}px`;
      hl.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [current]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(current + 1));
    window.history.replaceState(null, "", url);
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= VARIANTS.length) setCurrent(num - 1);
      else if (e.key === "ArrowRight")
        setCurrent((c) => (c + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft")
        setCurrent((c) => (c - 1 + VARIANTS.length) % VARIANTS.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const mode: UptimeMode = modeOverride ?? history?.mode ?? "duration";
  const { Component } = VARIANTS[current];

  return (
    <div className="proto-host">
      <Client />
      <SectionGroup className="-mt-8 pt-0 pb-24">
        <Section id="uptime-calculation-prototype">
          <Component
            key={`${current}-${mode}`}
            mode={mode}
            configurationHref={`/status-pages/${id}/components#components-configuration`}
            timezoneHref={`/status-pages/${id}/edit#timezone`}
          />
        </Section>
      </SectionGroup>
      <nav
        className="proto-picker"
        aria-label="Prototype variants"
        data-ready={ready ? "" : undefined}
      >
        <span
          ref={highlightRef}
          className="proto-picker-highlight"
          aria-hidden="true"
        />
        {VARIANTS.map((v, i) => (
          <button
            key={v.name}
            type="button"
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="proto-picker-item"
            data-active={i === current ? "" : undefined}
            aria-current={i === current ? "true" : undefined}
            onClick={() => setCurrent(i)}
          >
            {v.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
