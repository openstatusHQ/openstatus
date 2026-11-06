"use client";

import { Search as SearchIcon } from "@openstatus/icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@openstatus/ui/components/ui/input-group";
import { useQueryStates } from "nuqs";
import { useEffect, useRef } from "react";

import { pageParser, qParser } from "./search-params";

export function ServiceSearch() {
  const [{ q }, setParams] = useQueryStates({ q: qParser, page: pageParser });
  const setQ = (value: string) => setParams({ q: value, page: null });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const active = document.activeElement;
      const tag = active?.tagName.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form action="/status" role="search" className="not-prose my-0!">
      <InputGroup className="h-10! rounded-none ps-1 pe-2 text-base md:text-base">
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          type="search"
          name="q"
          placeholder="Search 3,000+ services, e.g. Anthropic, GitHub, Stripe"
          aria-label="Search services"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && q !== "") {
              e.preventDefault();
              setQ("");
              inputRef.current?.blur();
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <kbd className="border-border bg-muted text-muted-foreground hidden rounded-none! border px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
            /
          </kbd>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
