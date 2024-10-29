"use client";

import { cn } from "@/lib/utils";
import { InputWithAddons } from "@openstatus/ui/src/components/input-with-addons";
import { Slider } from "@openstatus/ui/src/components/slider";
import { useMemo, useState } from "react";

const MAX_REGIONS = 35;

const slides = [
  {
    key: "30s",
    value: 2 * 60 * 24 * 30,
  },
  {
    key: "1m",
    value: 60 * 24 * 30,
  },
  {
    key: "5m",
    value: 12 * 24 * 30,
  },
  {
    key: "10m",
    value: 6 * 24 * 30,
  },
  {
    key: "30m",
    value: 2 * 24 * 30,
  },
  {
    key: "1h",
    value: 24 * 30,
  },
];

export function PricingSlider() {
  const [index, setIndex] = useState<number[]>([2]);
  const [inputValue, setInputValue] = useState<number>(6);
  const region = useMemo(() => slides[index[0]].value, [index]);
  const total = useMemo(() => region * inputValue, [region, inputValue]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-8 sm:grid-cols-3">
        <div className="grid gap-2 sm:col-span-2">
          <h4 className="font-semibold text-2xl">Total requests per monitor</h4>
          <p className="text-muted-foreground">
            Check how many requests you will make with OpenStatus for a single
            monitor over the selected time period.
          </p>
        </div>
        <div className="flex justify-end">
          <div className="min-w-36 max-w-min">
            <InputWithAddons
              type="number"
              min={0}
              max={MAX_REGIONS}
              step={1}
              trailing="regions"
              className="bg-background text-right font-mono"
              value={inputValue}
              onChange={(e) =>
                setInputValue(Number.parseInt(e.target.value) || 0)
              }
            />
          </div>
        </div>
      </div>
      <div className="grid gap-8 sm:grid-cols-3">
        <div className="mt-2 grid w-full gap-2 sm:col-span-2">
          <Slider
            min={0}
            max={slides.length - 1}
            step={1}
            minStepsBetweenThumbs={1}
            value={index}
            onValueChange={setIndex}
          />
          <div className="flex items-center justify-between">
            {slides.map((slide, _i) => (
              // TODO: make them clickable
              <div
                key={slide.key}
                className={cn(
                  "text-left font-mono text-muted-foreground text-xs",
                )}
              >
                {slide.key}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mt-0.5 text-right text-sm">
            <span className="font-medium font-mono">
              {new Intl.NumberFormat("us").format(region).toString()} pings{" "}
            </span>{" "}
            <span className="font-normal text-muted-foreground">
              / region / month
            </span>
          </p>
        </div>
      </div>
      <div>
        <p className="text-right">
          <span className="font-medium font-mono text-lg">
            {new Intl.NumberFormat("us").format(total).toString()} pings{" "}
          </span>{" "}
          <span className="font-normal text-muted-foreground">/ month</span>
        </p>
      </div>
    </div>
  );
}
