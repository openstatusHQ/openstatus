"use client";

import { HelpCircle } from "lucide-react";
import * as React from "react";

import { Label } from "@openstatus/ui/src/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/src/components/popover";
import { Separator } from "@openstatus/ui/src/components/separator";

import { quantiles } from "@/lib/monitor/utils";
import type { Quantile } from "@/lib/monitor/utils";
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
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
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
