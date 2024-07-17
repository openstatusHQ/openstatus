"use client";

import type { UseFormReturn } from "react-hook-form";

import type { InsertMonitor, WorkspacePlan } from "@openstatus/db/src/schema";
import { monitorPeriodicitySchema } from "@openstatus/db/src/schema/constants";
import { getLimit } from "@openstatus/db/src/schema/plan/utils";

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
import { groupByContinent } from "@openstatus/utils";

import { CheckboxLabel } from "../shared/checkbox-label";
import { SectionHeader } from "../shared/section-header";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";

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
  limits: Limits;
  plan: WorkspacePlan;
}

export function SectionScheduling({ form, limits, plan }: Props) {
  const periodicityLimit = getLimit(limits, "periodicity");
  const regionsLimit = getLimit(limits, "regions");
  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Schedule and Regions"
        description="Customize the period of time and the regions where your endpoint will be monitored."
      />
      <div className="grid md:grid-cols-3 sm:grid-cols-2">
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
        // biome-ignore lint/correctness/noUnusedVariables: <explanation>
        render={({ field }) => {
          return (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Regions</FormLabel>
                <FormDescription>
                  Select the regions you want to monitor your endpoint from.{" "}
                  <br />
                  {plan === "free"
                    ? "Only a few regions are available in the free plan. Upgrade to access all regions."
                    : ""}
                </FormDescription>
              </div>
              <div>
                {Object.entries(groupByContinent)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([continent, regions]) => {
                    return { continent, regions };
                  })
                  .map((current) => {
                    return (
                      <div key={current.continent} className="py-2">
                        {current.continent}

                        <div className="grid grid-cols-3 grid-rows-1 gap-2 pt-1">
                          {current.regions
                            .sort((a, b) =>
                              a.location.localeCompare(b.location)
                            )
                            .map((item) => {
                              return (
                                <FormField
                                  key={item.code}
                                  control={form.control}
                                  name="regions"
                                  render={({ field }) => {
                                    const { flag, location } = item;
                                    return (
                                      <FormItem
                                        key={item.code}
                                        className="h-full w-full"
                                      >
                                        <FormControl className="h-full">
                                          <CheckboxLabel
                                            disabled={
                                              !regionsLimit.includes(item.code)
                                            }
                                            id={item.code}
                                            name="region"
                                            checked={field.value?.includes(
                                              item.code
                                            )}
                                            onCheckedChange={(checked) => {
                                              console.log(field.value);
                                              return checked
                                                ? field.onChange([
                                                    ...(field.value
                                                      ? field.value
                                                      : []),
                                                    item.code,
                                                  ])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) =>
                                                        value !== item.code
                                                    )
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
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <FormMessage />
            </FormItem>
          );
        }}
      />
    </div>
  );
}
