"use client";

import { Check } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import {
  parseAsNumberLiteral,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import { useEffect } from "react";

import { INTERVALS, PERIODS, periodToMinInterval } from "@/data/metrics.client";

const MAPPING = {
  5: "5 minutes",
  15: "15 minutes",
  30: "30 minutes",
  60: "1 hour",
  120: "2 hours",
  240: "4 hours",
  480: "8 hours",
  1440: "1 day",
} as const;

const parseInterval = parseAsNumberLiteral(INTERVALS).withDefault(30);
const parsePeriod = parseAsStringLiteral(PERIODS).withDefault("1d");

export function DropdownInterval() {
  const [interval, setInterval] = useQueryState("interval", parseInterval);
  const [period] = useQueryState("period", parsePeriod);

  const min = periodToMinInterval[period];
  const options = INTERVALS.filter((item) => item >= min);

  // snap a now-too-fine selection up to the period's floor so the dropdown,
  // URL, and charts agree (e.g. 5min carried over into the 90d view)
  useEffect(() => {
    if (interval < min) setInterval(min);
  }, [interval, min, setInterval]);

  const selected = Math.max(interval, min) as (typeof INTERVALS)[number];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {MAPPING[selected]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
            Resolution
          </DropdownMenuLabel>
          {options.map((item) => (
            <DropdownMenuItem key={item} onSelect={() => setInterval(item)}>
              {MAPPING[item]}
              {selected === item ? (
                <Check className="ml-auto shrink-0" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
