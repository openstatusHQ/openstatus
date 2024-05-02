"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertPage, Monitor } from "@openstatus/db/src/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@openstatus/ui";

import { CheckboxLabel } from "../shared/checkbox-label";
import { SectionHeader } from "../shared/section-header";

interface Props {
  monitors?: Monitor[];
  form: UseFormReturn<InsertPage>;
}

export function SectionMonitor({ monitors, form }: Props) {
  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Connected Monitors"
        description="Select the monitors you want to display on your status page. Inactive monitors will not be shown."
      />
      <FormField
        control={form.control}
        name="monitors"
        render={() => (
          <FormItem>
            <div className="grid grid-cols-1 grid-rows-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {monitors?.map((item) => (
                <FormField
                  key={item.id}
                  control={form.control}
                  name="monitors"
                  render={({ field }) => {
                    return (
                      <FormItem key={item.id} className="h-full w-full">
                        <FormControl className="w-full">
                          <CheckboxLabel
                            id={String(item.id)}
                            checked={field.value?.includes(item.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([
                                    ...(field.value || []),
                                    item.id,
                                  ])
                                : field.onChange(
                                    field.value?.filter(
                                      (value) => value !== item.id,
                                    ),
                                  );
                            }}
                            className="flex w-full flex-col items-start gap-2"
                          >
                            <span>{item.name}</span>
                            <span className="text-muted-foreground w-full truncate font-normal">
                              {item.url}
                            </span>
                          </CheckboxLabel>
                        </FormControl>
                      </FormItem>
                    );
                  }}
                />
              ))}
            </div>
            {!monitors || monitors.length === 0 ? (
              <FormDescription>Missing monitors.</FormDescription>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
