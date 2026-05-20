"use client";

import { SearchIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useRef } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@openstatus/ui/components/ui/input-group";

import { api } from "@/trpc/rq-client";
import { filterServices } from "./filter-services";
import { qParser } from "./search-params";

export function ServiceSearch() {
  const [q, setQ] = useQueryState("q", qParser);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: services } = api.externalService.grid.useQuery();

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

  const total = services?.length ?? 0;
  const matched = services ? filterServices(services, q).length : 0;
  const showCount = q.trim() !== "" && services !== undefined;

  return (
    <div className="not-prose mb-4 flex flex-col gap-1">
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
            }
          }}
        />
      </InputGroup>
      {showCount && (
        <p className="text-muted-foreground text-xs" role="status">
          Showing {matched} of {total} services
        </p>
      )}
    </div>
  );
}
