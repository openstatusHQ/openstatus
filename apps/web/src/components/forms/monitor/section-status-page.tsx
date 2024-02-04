"use client";

import type { UseFormReturn } from "react-hook-form";

import type {
  InsertMonitor,
  Page,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

import { CheckboxLabel } from "./checkbox-label";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  plan: WorkspacePlan;
  pages?: Page[];
}

// FIXME: the `CheckLabel` doesn't take the full space

export function SectionStatusPage({ form, pages }: Props) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid gap-1">
        <h4 className="text-foreground font-medium">Status Page</h4>
        <p className="text-muted-foreground text-sm">
          Customize the informations about your monitor on the corresponding
          status page.
        </p>
      </div>
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Input
                placeholder="Determines the api health of our services."
                {...field}
              />
            </FormControl>
            <FormDescription>
              Provide your users with information about it.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="pages"
        render={({ field }) => {
          return (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Status Pages</FormLabel>
                <FormDescription>
                  Select the pages where you want to display the monitor.
                </FormDescription>
              </div>
              <div className="grid grid-cols-1 grid-rows-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {pages?.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="pages"
                    render={({ field }) => {
                      return (
                        <FormItem key={item.id} className="h-full w-full">
                          <FormControl className="h-full">
                            <CheckboxLabel
                              id={String(item.id)}
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([
                                      ...(field.value ? field.value : []),
                                      item.id,
                                    ])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.id,
                                      ),
                                    );
                              }}
                            >
                              <span>{item.title}</span>
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
