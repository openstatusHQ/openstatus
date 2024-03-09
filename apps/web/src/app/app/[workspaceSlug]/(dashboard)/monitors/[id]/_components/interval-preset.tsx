"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";

import {
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from "@openstatus/ui";

import { intervals } from "../utils";
import type { Interval } from "../utils";
import { SearchParamsPreset } from "./search-params-preset";

export function IntervalPreset({ interval }: { interval: Interval }) {
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
