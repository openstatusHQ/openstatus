"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { cn } from "@/lib/utils";

type DataTableDateRangePicker = React.HTMLAttributes<HTMLDivElement>;

export function DataTableDateRangePicker({
  className,
}: DataTableDateRangePicker) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();
  const [date, setDate] = React.useState<DateRange | undefined>();

  React.useEffect(() => {
    if (searchParams) {
      const from =
        (searchParams.has("fromDate") && searchParams.get("fromDate")) ||
        undefined;
      const to =
        (searchParams.has("toDate") && searchParams.get("toDate")) || undefined;
      setDate({
        from: from ? new Date(Number(from)) : undefined,
        to: to ? new Date(Number(to)) : undefined,
      });
    }
  }, [searchParams]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-[260px] justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={(value) => {
              setDate(value);
              const { fromDate, toDate } = manipulateDate(value);

              const searchParams = updateSearchParams({
                fromDate,
                toDate,
              });
              router.replace(`${pathname}?${searchParams}`);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Whenever you select a date, it will use the midnight timestamp of that date.
 * We need to add a day minus one second to include the whole day.
 */
function manipulateDate(date?: DateRange | null) {
  const isToDateMidnight = String(date?.to?.getTime()).endsWith("00000");

  const addOneDayToDate = date?.to
    ? addDays(new Date(date.to), 1).getTime() - 1
    : null;

  return {
    fromDate: date?.from?.getTime() || null,
    toDate: isToDateMidnight ? addOneDayToDate : date?.to?.getTime() || null,
  };
}
