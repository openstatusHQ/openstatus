"use client";

import type { UseFormReturn } from "react-hook-form";

import type { InsertMonitor } from "@openstatus/db/src/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertMonitor>;
}

// FIXME: replace with enum
// TODO: can be also replaced by a custom number input with max value (+ validation)
const limits = [100, 250, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 40_000];

function formatDuration(ms: number) {
  if (ms < 0) ms = -ms;
  const time = {
    day: Math.floor(ms / 86400000),
    hour: Math.floor(ms / 3600000) % 24,
    min: Math.floor(ms / 60000) % 60,
    sec: Math.floor(ms / 1000) % 60,
    ms: Math.floor(ms) % 1000,
  };
  return Object.entries(time)
    .filter((val) => val[1] !== 0)
    .map(([key, val]) => `${val} ${key}${val !== 1 && key !== "ms" ? "s" : ""}`)
    .join(", ");
}

export function SectionLimits({ form }: Props) {
  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Response Time Limits"
        description="Check when your endpoint is taking too long to respond. And set the limit to be considered degraded."
      />
      <FormField
        control={form.control}
        name="id" // FIXME: should be something like 'limitDegraded'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Degraded limit</FormLabel>
            <Select
              onValueChange={(value) => field.onChange(parseInt(value))}
              defaultValue={String(field.value)}
            >
              <FormControl>
                <SelectTrigger className="sm:w-[200px]">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {limits.map((limit) => (
                  <SelectItem key={limit} value={String(limit)}>
                    {formatDuration(limit)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              When the response time exceeds this limit, the monitor is will be
              considered as <span className="text-amber-500">degraded</span>.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="id" // FIXME: should be something like 'limitFailed'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Failed limit</FormLabel>
            <Select
              onValueChange={(value) => field.onChange(parseInt(value))}
              defaultValue={String(field.value)}
            >
              <FormControl>
                <SelectTrigger className="sm:w-[200px]">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {limits.map((limit) => (
                  <SelectItem key={limit} value={String(limit)}>
                    {formatDuration(limit)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              When the response time exceeds this limit, the monitor is will be
              considered as <span className="text-rose-500">failed</span>.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
