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
