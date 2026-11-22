"use client";

import { Settings } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import NextLink from "next/link";

import {
  UPTIME_MODES,
  type UptimeMode,
} from "@/data/uptime-calculation.client";

/**
 * The calculation the history counts, as an inline sentence trigger like
 * `DropdownPeriod`. Picking another only previews it; the public page keeps
 * `configured` until it is changed under `configurationHref`.
 */
export function CalculationSelect({
  value,
  configured,
  configurationHref,
  onValueChange,
}: {
  value: UptimeMode;
  configured: UptimeMode;
  configurationHref: string;
  /** null for the page's own calculation, so the search param drops out */
  onValueChange: (value: UptimeMode | null) => void;
}) {
  const current = UPTIME_MODES.find((m) => m.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="decoration-border hover:decoration-foreground data-[state=open]:decoration-foreground h-auto rounded-md px-1 py-0 text-[length:inherit] leading-[inherit] font-medium underline underline-offset-3 hover:bg-transparent dark:hover:bg-transparent"
        >
          {current?.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Uptime calculation
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const mode = UPTIME_MODES.find((m) => m.value === next)?.value;
            if (mode) onValueChange(mode === configured ? null : mode);
          }}
        >
          {UPTIME_MODES.map((mode) => (
            <DropdownMenuRadioItem key={mode.value} value={mode.value}>
              {mode.label}
              {mode.value === configured ? (
                <span className="text-muted-foreground ml-auto text-xs">
                  Public
                </span>
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <NextLink href={configurationHref}>
            <Settings />
            Change calculation
          </NextLink>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
