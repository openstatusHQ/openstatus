"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertMonitor, WorkspacePlan } from "@openstatus/db/src/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Switch,
} from "@openstatus/ui";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  plan: WorkspacePlan;
}

export function General({ form }: Props) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Documenso" {...field} />
              </FormControl>
              <FormDescription>Displayed on the status page.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between space-x-1 space-y-0 sm:col-span-2">
              <FormLabel>Active</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value || false}
                  onCheckedChange={(value) => field.onChange(value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
