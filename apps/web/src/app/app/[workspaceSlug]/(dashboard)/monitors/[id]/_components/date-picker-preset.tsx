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
import { periodFormatter } from "../utils";
import type { Period } from "../utils";

// TODO: create a simple SearchParamPreset component with generic T
// and a `formatter` function and a `icon: ValidIcon` as prop

export function DatePickerPreset({
  disabled,
  defaultValue,
  values,
}: {
  disabled?: boolean;
  defaultValue?: Period;
  values: readonly Period[];
  searchParam?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  function onSelect(value: Period) {
    const searchParams = updateSearchParams({ period: value });
    router.replace(`${pathname}?${searchParams}`, { scroll: false });
  }

  return (
    <Select
      defaultValue={defaultValue}
      onValueChange={onSelect}
      disabled={disabled}
    >
      <SelectTrigger className="bg-background w-[150px] text-left" id="period">
        <span className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          <SelectValue placeholder="Pick a range" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {values.map((value) => (
          <SelectItem key={value} value={value}>
            {periodFormatter(value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
