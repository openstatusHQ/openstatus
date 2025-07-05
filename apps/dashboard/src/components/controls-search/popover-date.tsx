import { endOfDay, startOfDay, subDays, subHours } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/date-picker";
import { parseAsIsoDateTime, useQueryState } from "nuqs";
import { useRef } from "react";

export function PopoverDate() {
  const today = useRef(new Date());
  const [from, setFrom] = useQueryState(
    "from",
    parseAsIsoDateTime.withDefault(startOfDay(today.current))
  );
  const [to, setTo] = useQueryState(
    "to",
    parseAsIsoDateTime.withDefault(endOfDay(today.current))
  );

  const periods = [
    {
      id: "today",
      label: "Today",
      values: {
        from: startOfDay(today.current),
        to: endOfDay(today.current),
      },
    },
    {
      id: "yesterday",
      label: "Yesterday",
      values: {
        from: startOfDay(subDays(today.current, 1)),
        to: endOfDay(subDays(today.current, 1)),
      },
    },
    {
      id: "lastHour",
      label: "Last hour",
      values: {
        from: subHours(today.current, 1),
        to: today.current,
      },
    },
    {
      id: "last6Hours",
      label: "Last 6 hours",
      values: {
        from: subHours(today.current, 5),
        to: today.current,
      },
    },
    {
      id: "last7Days",
      label: "Last 7 days",
      values: {
        from: subDays(today.current, 6),
        to: today.current,
      },
    },
    {
      id: "last14Days",
      label: "Last 14 days",
      values: {
        from: subDays(today.current, 13),
        to: today.current,
      },
    },
  ];

  const selected = periods.find((period) => {
    return (
      from.getTime() === period.values.from.getTime() &&
      to.getTime() === period.values.to.getTime()
    );
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {selected?.label ?? "Select Date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <DatePicker
          actions={periods}
          range={{ from, to }}
          onSelect={(range) => {
            setFrom(range.from ?? null);
            setTo(range.to ?? null);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
