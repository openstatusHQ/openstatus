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

import { intervals } from "@/lib/monitor/utils";
import type { Interval } from "@/lib/monitor/utils";
import { SearchParamsPreset } from "./search-params-preset";

export function IntervalPreset({ interval }: { interval: Interval }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor="interval">Interval</Label>
        <Popover>
          <PopoverTrigger>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
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
      <SearchParamsPreset
        disabled={false}
        defaultValue={interval}
        values={intervals}
        searchParam="interval"
        icon="hour-glass"
        placeholder="Pick an interval"
      />
    </div>
  );
}
