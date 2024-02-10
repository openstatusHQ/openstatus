"use client";

import type { UseFormReturn } from "react-hook-form";

import type { InsertMonitor, WorkspacePlan } from "@openstatus/db/src/schema";
import { monitorPeriodicitySchema } from "@openstatus/db/src/schema";
import { getLimit } from "@openstatus/plans";
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
import { flyRegions, flyRegionsDict } from "@openstatus/utils";

import { CheckboxLabel } from "./checkbox-label";

// TODO: centralize in a shared file!
const cronJobs = [
  { value: "30s", label: "30 seconds" },
  { value: "1m", label: "1 minute" },
  { value: "5m", label: "5 minutes" },
  { value: "10m", label: "10 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
] as const;

interface Props {
  form: UseFormReturn<InsertMonitor>;
  plan: WorkspacePlan;
}

export function SectionScheduling({ form, plan }: Props) {
  const periodicityLimit = getLimit(plan, "periodicity");
  return (
    <div className="grid w-full gap-4">
      <div className="grid gap-1">
        <h4 className="text-foreground font-medium">Schedule and Regions</h4>
        <p className="text-muted-foreground text-sm">
          Customize the period of time and the regions where your endpoint will
          be monitored.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 md:grid-cols-3">
        <FormField
          control={form.control}
          name="periodicity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequency</FormLabel>
              <Select
                onValueChange={(value) =>
                  field.onChange(monitorPeriodicitySchema.parse(value))
                }
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="How often should it check your endpoint?" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {cronJobs.map(({ label, value }) => (
                    <SelectItem
                      key={value}
                      value={value}
                      disabled={!periodicityLimit.includes(value)}
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Frequency of how often your endpoint will be pinged.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="regions"
        render={({ field }) => {
          return (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Regions</FormLabel>
                <FormDescription>
                  Select the regions you want to monitor your endpoint from.
                </FormDescription>
              </div>
              <div className="grid grid-cols-1 grid-rows-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {flyRegions.map((item) => (
                  <FormField
                    key={item}
                    control={form.control}
                    name="regions"
                    render={({ field }) => {
                      const { flag, location } = flyRegionsDict[item];
                      return (
                        <FormItem key={item} className="h-full w-full">
                          <FormControl className="h-full">
                            <CheckboxLabel
                              id={item}
                              checked={field.value?.includes(item)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([
                                      ...(field.value ? field.value : []),
                                      item,
                                    ])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item,
                                      ),
                                    );
                              }}
                            >
                              {location} {flag}
                            </CheckboxLabel>
                          </FormControl>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    </div>
  );
}
