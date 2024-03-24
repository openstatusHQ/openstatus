"use client";

import { HelpCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import {
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from "@openstatus/ui";

import { quantiles } from "../utils";
import type { Quantile } from "../utils";
import { SearchParamsPreset } from "./search-params-preset";

export function QuantilePreset({
  quantile,
  disabled,
}: {
  quantile: Quantile;
  disabled?: boolean;
}) {
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
      <SearchParamsPreset
        disabled={disabled}
        defaultValue={quantile}
        values={quantiles}
        searchParam="quantile"
        icon="candlestick-chart"
        placeholder="Pick a quantile"
        formatter={(value: Quantile) => (
          <span className="uppercase">{value}</span>
        )}
      />
    </div>
  );
}
