"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { HelpCircle, Hourglass } from "lucide-react";

import {
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { cn } from "@/lib/utils";
import { intervals } from "../utils";
import type { Interval } from "../utils";

export function IntervalPreset({
  interval,
  className,
}: {
  interval: Interval;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  function onSelect(value: Interval) {
    const searchParams = updateSearchParams({ interval: value });
    router.replace(`${pathname}?${searchParams}`, { scroll: false });
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor="interval">Interval</Label>
        <Popover>
          <PopoverTrigger>
            <HelpCircle className="text-muted-foreground h-4 w-4" />
          </PopoverTrigger>
          <PopoverContent side="top" className="text-sm">
            <p>Aggregate and process data at regular time intervals.</p>
            <Separator className="my-2" />
            <p className="text-muted-foreground">
              30m should be aligned to the beginning of 30-minute intervals for
              data analysis and aggregation purposes
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <Select onValueChange={onSelect} defaultValue={interval}>
        <SelectTrigger className={cn("w-[150px]", className)} id="interval">
          <span className="flex items-center gap-2">
            <Hourglass className="h-4 w-4" />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {intervals.map((interval) => (
            <SelectItem key={interval} value={interval}>
              {interval}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
