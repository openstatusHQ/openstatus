"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarIcon } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { cn } from "@/lib/utils";
import type { Period } from "../utils";

export function DatePickerPreset({ period }: { period: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  function onSelect(value: Period) {
    const searchParams = updateSearchParams({
      period: value,
    });
    router.replace(`${pathname}?${searchParams}`);
  }

  function renderLabel() {
    if (period === "day") return "Today";
    if (period === "3d") return "Last 3 days";
    if (period === "7d") return "Last week";
    if (period === "30d") return "Last month";
    return "Pick a range";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id="date"
          variant={"outline"}
          className={cn(
            "w-[140px] justify-start text-left font-normal",
            !period && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {renderLabel()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onSelect("day")}>
          Today
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("3d")}>
          Last 3 days
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("7d")}>
          Last week
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("30d")}>
          Last month
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
