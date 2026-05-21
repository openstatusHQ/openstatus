"use client";

import { SearchIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useRef } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@openstatus/ui/components/ui/input-group";

import { qParser } from "./search-params";

export function ServiceSearch() {
  const [q, setQ] = useQueryState("q", qParser);
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
    <div className="not-prose mb-4">
      <InputGroup className="rounded-none">
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          type="search"
          placeholder="Search services…"
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
          <kbd className="hidden rounded-none! border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
            /
          </kbd>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
