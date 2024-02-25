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

import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  plan: WorkspacePlan;
}

export function General({ form }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
      <SectionHeader
        title="Basic Information"
        description="Be able to find your monitor easily."
      />
      <div className="flex w-full gap-4 sm:col-span-2">
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
            <FormItem className="flex flex-row items-center justify-between space-x-1 space-y-0">
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
      {/* TODO: add FancyBox with "Create Tag option" once `monitor_tabs` db table is set up */}
    </div>
  );
}
