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
  parseAsNumberLiteral,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import { useEffect } from "react";

import {
  INTERVALS,
  PERIODS,
  periodToMaxInterval,
  periodToMinInterval,
} from "@/data/metrics.client";

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
  const max = periodToMaxInterval[period];
  const options = INTERVALS.filter((item) => item >= min && item <= max);
  const selected = Math.min(
    Math.max(interval, min),
    max,
  ) as (typeof INTERVALS)[number];

  // snap an out-of-range selection into the period's bounds so the dropdown,
  // URL, and charts agree (e.g. 5min carried into 90d, or 1d carried into 1d)
  useEffect(() => {
    if (interval !== selected) setInterval(selected);
  }, [interval, selected, setInterval]);

  return (
    <Select
      value={String(selected)}
      onValueChange={(value) =>
        setInterval(Number(value) as (typeof INTERVALS)[number])
      }
    >
      <SelectTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="decoration-border hover:decoration-foreground data-[state=open]:decoration-foreground h-auto rounded-md px-1 py-0 text-[length:inherit] leading-[inherit] font-medium underline underline-offset-3 hover:bg-transparent dark:hover:bg-transparent"
        >
          <SelectValue />
        </Button>
      </SelectTrigger>
      <SelectContent position="item-aligned">
        <SelectGroup>
          <SelectLabel>Resolution</SelectLabel>
          {options.map((item) => (
            <SelectItem key={item} value={String(item)}>
              {MAPPING[item]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
