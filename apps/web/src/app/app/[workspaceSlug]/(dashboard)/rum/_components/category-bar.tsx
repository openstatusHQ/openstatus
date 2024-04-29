// TODO: move to @/components folder

import React from "react";

import type { WebVitalEvents } from "@openstatus/rum";
import { webVitalsConfig } from "@openstatus/rum";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { cn } from "@/lib/utils";

const MAX_VALUE_RATIO = 1.3; // avoiding Infinity as number

interface CategoryBarProps {
  values: {
    color: string;
    min: number;
    max: number;
  }[];
  marker: number;
}

export function CategoryBar({ values, marker }: CategoryBarProps) {
  const getMarkerColor = React.useCallback(() => {
    for (const value of values) {
      if (marker >= value.min && marker <= value.max) {
        return value.color;
      }
    }
    return "bg-gray-500";
  }, [values, marker]);

  /**
   * Get the max value from the values array
   * If the max value is not finite, calculate the max value based on the ratio
   */
  const getMaxValue = React.useCallback(() => {
    const maxValue = values.reduce((acc, value) => {
      if (Number.isFinite(value.max)) return Math.max(acc, value.max);
      return acc * MAX_VALUE_RATIO;
    }, 0);
    return Math.max(maxValue, marker);
  }, [values, marker]);

  const valuesWithPercentage = React.useMemo(
    () =>
      values.map((value) => {
        const max = Number.isFinite(value.max) ? value.max : getMaxValue();
        return {
          ...value,
          percentage: (max - value.min) / getMaxValue(),
        };
      }),
    [values, getMaxValue],
  );

  return (
    <div className="relative w-full">
      <div className="relative mb-1 flex w-full">
        <div className="text-muted-foreground absolute bottom-0 left-0 flex items-center text-xs">
          0
        </div>
        {valuesWithPercentage.slice(0, values.length - 1).map((value, i) => {
          const width = `${(value.percentage * 100).toFixed(2)}%`;
          return (
            <div
              key={i}
              className="flex items-center justify-end"
              style={{ width }}
            >
              <span className="text-muted-foreground left-1/2 translate-x-1/2 text-xs">
                {value.max}
              </span>
            </div>
          );
        })}
        {/* REMINDER: could be a thing - only display if maxValue !== Infinity */}
        <div className="text-muted-foreground absolute bottom-0 right-0 flex items-center text-xs">
          {getMaxValue()}
        </div>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {valuesWithPercentage.map((value, i) => {
          const width = `${(value.percentage * 100).toFixed(2)}%`;
          return <div key={i} className={cn(value.color)} style={{ width }} />;
        })}
      </div>
      <div
        className="absolute -bottom-0.5 right-1/2 w-5 -translate-x-1/2"
        style={{ left: `${(marker / getMaxValue()) * 100}%` }}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "ring-border mx-auto h-4 w-1 rounded-full ring-2",
                  getMarkerColor(),
                )}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{marker}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
