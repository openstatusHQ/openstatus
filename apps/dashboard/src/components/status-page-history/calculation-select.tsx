"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { SelectTrigger } from "@radix-ui/react-select";

import {
  UPTIME_MODES,
  type UptimeMode,
} from "@/data/uptime-calculation.client";

/**
 * The calculation the history counts, as an inline sentence trigger like
 * `DropdownInterval`. Picking another only previews it; the public page keeps
 * `configured` until it is changed in the components configuration.
 */
export function CalculationSelect({
  value,
  configured,
  onValueChange,
}: {
  value: UptimeMode;
  configured: UptimeMode;
  /** null for the page's own calculation, so the search param drops out */
  onValueChange: (value: UptimeMode | null) => void;
}) {
  const current = UPTIME_MODES.find((m) => m.value === value);
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const mode = UPTIME_MODES.find((m) => m.value === next)?.value;
        if (mode) onValueChange(mode === configured ? null : mode);
      }}
    >
      <SelectTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="decoration-border hover:decoration-foreground data-[state=open]:decoration-foreground h-auto rounded-md px-1 py-0 text-[length:inherit] leading-[inherit] font-medium underline underline-offset-3 hover:bg-transparent dark:hover:bg-transparent"
        >
          <SelectValue>{current?.label}</SelectValue>
        </Button>
      </SelectTrigger>
      <SelectContent position="item-aligned">
        <SelectGroup>
          <SelectLabel>Uptime calculation</SelectLabel>
          {UPTIME_MODES.map((mode) => (
            <SelectItem key={mode.value} value={mode.value}>
              {mode.label}
              {mode.value === configured ? (
                <span className="text-muted-foreground text-xs">Public</span>
              ) : null}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
