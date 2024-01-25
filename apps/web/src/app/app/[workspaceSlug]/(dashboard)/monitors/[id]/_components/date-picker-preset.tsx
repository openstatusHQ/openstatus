"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarIcon, HelpCircle } from "lucide-react";

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
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { periods } from "../utils";
import type { Period } from "../utils";

export function DatePickerPreset({ period }: { period: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  function onSelect(value: Period) {
    const searchParams = updateSearchParams({ period: value });
    router.replace(`${pathname}?${searchParams}`);
  }

  function renderLabel(period?: Period) {
    if (period === "1h") return "Last hour";
    if (period === "1d") return "Last day";
    if (period === "3d") return "Last 3 days";
    return "Pick a range";
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor="period">Period</Label>
        <Popover>
          <PopoverTrigger>
            <HelpCircle className="text-muted-foreground h-4 w-4" />
          </PopoverTrigger>
          <PopoverContent side="top" className="text-sm">
            <p>Specifies a time range for analysis.</p>
          </PopoverContent>
        </Popover>
      </div>
      <Select defaultValue={period} onValueChange={onSelect}>
        <SelectTrigger className="w-[150px] text-left" id="period">
          <span className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            <SelectValue placeholder="Pick a range" />
          </span>
        </SelectTrigger>
        <SelectContent>
          {periods.map((period) => (
            <SelectItem key={period} value={period}>
              {renderLabel(period)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
