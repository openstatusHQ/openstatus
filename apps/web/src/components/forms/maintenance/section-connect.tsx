"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertMaintenance, Monitor } from "@openstatus/db/src/schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui";

import { CheckboxLabel } from "../shared/checkbox-label";

interface Props {
  form: UseFormReturn<InsertMaintenance>;
  monitors?: Monitor[];
}

export function SectionConnect({ form, monitors }: Props) {
  return (
    <div className="grid w-full gap-4">
      <div className="flex flex-col gap-3">
        <FormField
          control={form.control}
          name="monitors"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel>Monitors</FormLabel>
                <FormDescription>
                  Select the monitors that are affected by this maintenance.{" "}
                  <span className="font-medium">
                    We will not trigger any ping during that period.
                  </span>
                </FormDescription>
              </div>
              <div className="grid grid-cols-1 grid-rows-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
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
                              name="monitor"
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
                            >
                              {item.name}
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
    </div>
  );
}
