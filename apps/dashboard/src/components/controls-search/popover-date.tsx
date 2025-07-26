import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateRange } from "@/lib/formatter";
import { endOfDay, startOfDay, subDays, subHours } from "date-fns";
import { parseAsIsoDateTime, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";

export function PopoverDate() {
  const [open, setOpen] = useState(false);
  const today = useRef(new Date());
  const [from, setFrom] = useQueryState(
    "from",
    parseAsIsoDateTime.withDefault(startOfDay(today.current)),
  );
  const [to, setTo] = useQueryState(
    "to",
    parseAsIsoDateTime.withDefault(endOfDay(today.current)),
  );
  const [range, setRange] = useState<DateRange>({ from, to });

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const presets = useMemo(
    () => [
      {
        id: "today",
        label: "Today",
        values: {
          from: startOfDay(today.current),
          to: endOfDay(today.current),
        },
        shortcut: "t",
      },
      {
        id: "yesterday",
        label: "Yesterday",
        values: {
          from: startOfDay(subDays(today.current, 1)),
          to: endOfDay(subDays(today.current, 1)),
        },
        shortcut: "y",
      },
      {
        id: "lastHour",
        label: "Last hour",
        values: {
          from: subHours(today.current, 1),
          to: today.current,
        },
        shortcut: "h",
      },
      {
        id: "last6Hours",
        label: "Last 6 hours",
        values: {
          from: subHours(today.current, 5),
          to: today.current,
        },
        shortcut: "s",
      },
      {
        id: "last24Hours",
        label: "Last 24 hours",
        values: {
          from: subHours(today.current, 23),
          to: today.current,
        },
        shortcut: "d",
      },
      {
        id: "last7Days",
        label: "Last 7 days",
        values: {
          from: subDays(today.current, 6),
          to: today.current,
        },
        shortcut: "w",
      },
      {
        id: "last14Days",
        label: "Last 14 days",
        values: {
          from: subDays(today.current, 13),
          to: today.current,
        },
        shortcut: "b",
      },
    ],
    [today],
  );

  //   instead use `range` state
  const selected = presets.find((period) => {
    return (
      from.getTime() === period.values.from.getTime() &&
      to.getTime() === period.values.to.getTime()
    );
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!open) {
      setFrom(range.from ?? null);
      setTo(range.to ?? null);
    }
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!open) return;

      presets.map((preset) => {
        if (preset.shortcut === e.key) {
          setFrom(preset.values.from);
          setTo(preset.values.to);
          setRange({ from: preset.values.from, to: preset.values.to });
        }
      });
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [presets, open, setFrom, setTo]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {selected?.label ?? formatDateRange(from, to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" side="bottom" align="start">
        <DatePicker presets={presets} range={range} onSelect={setRange} />
      </PopoverContent>
    </Popover>
  );
}
