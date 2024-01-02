"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Hourglass } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { intervals } from "../utils";
import type { Interval } from "../utils";

export function IntervalPreset({ interval }: { interval: Interval }) {
  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  function onSelect(value: Interval) {
    const searchParams = updateSearchParams({ interval: value });
    router.replace(`${pathname}?${searchParams}`);
  }

  return (
    <Select onValueChange={onSelect} defaultValue={interval}>
      <SelectTrigger className="w-[100px]">
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
  );
}
