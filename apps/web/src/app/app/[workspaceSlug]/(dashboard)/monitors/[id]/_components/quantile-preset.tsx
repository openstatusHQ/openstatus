"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CandlestickChart, HelpCircle } from "lucide-react";

import {
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { cn } from "@/lib/utils";
import { quantiles } from "../utils";
import type { Quantile } from "../utils";

export function QuantilePreset({
  quantile,
  disabled,
  className,
}: {
  quantile: Quantile;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  function onSelect(value: Quantile) {
    const searchParams = updateSearchParams({ quantile: value });
    router.replace(`${pathname}?${searchParams}`, { scroll: false });
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor="quantile">Quantile</Label>
        <Popover>
          <PopoverTrigger>
            <HelpCircle className="text-muted-foreground h-4 w-4" />
          </PopoverTrigger>
          <PopoverContent side="top" className="text-sm">
            <p>
              Defines a statistical measure representing a specific percentile.
            </p>
            <Separator className="my-2" />
            <p className="text-muted-foreground">
              The p95 quantile represents the value below which 95% of the data
              points in a dataset fall, indicating a high percentile level
              within the distribution.
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <Select
        onValueChange={onSelect}
        defaultValue={quantile}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn("w-[150px] uppercase", className)}
          id="quantile"
        >
          <span className="flex items-center gap-2">
            <CandlestickChart className="h-4 w-4" />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {quantiles.map((quantile) => {
            return (
              <React.Fragment key={quantile}>
                {quantile === "avg" && <SelectSeparator />}
                <SelectItem value={quantile} className="uppercase">
                  {quantile}
                </SelectItem>
              </React.Fragment>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
