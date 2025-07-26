"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PERIODS } from "@/data/metrics.client";
import { Check } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

// TODO: where to move it?
export const PERIOD_VALUES = [
  {
    value: "1d",
    label: "Last day",
  },
  {
    value: "7d",
    label: "Last 7 days",
  },
  {
    value: "14d",
    label: "Last 14 days",
  },
] satisfies { value: (typeof PERIODS)[number]; label: string }[];

const parsePeriod = parseAsStringLiteral(PERIODS).withDefault("1d");

export function DropdownPeriod() {
  const [period, setPeriod] = useQueryState("period", parsePeriod);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {PERIOD_VALUES.find(({ value }) => value === period)?.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-medium text-muted-foreground text-xs">
            Period
          </DropdownMenuLabel>
          {PERIOD_VALUES.map(({ value, label }) => (
            <DropdownMenuItem key={value} onSelect={() => setPeriod(value)}>
              {label}
              {period === value ? <Check className="ml-auto shrink-0" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
