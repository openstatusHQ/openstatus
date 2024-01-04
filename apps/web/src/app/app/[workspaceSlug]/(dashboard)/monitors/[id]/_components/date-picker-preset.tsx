"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarIcon } from "lucide-react";

import {
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
    <Select defaultValue={period} onValueChange={onSelect}>
      <SelectTrigger className="w-[150px] text-left">
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
  );
}
