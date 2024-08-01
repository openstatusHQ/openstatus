"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  InsertMonitor,
  Notification,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import {
  Badge,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui";

import { CheckboxLabel } from "../shared/checkbox-label";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  notifications?: Notification[];
}

export function SectionNotifications({ form, notifications }: Props) {
  return (
    <div className="grid w-full gap-4">
      {/* <div className="grid gap-1">
        <h4 className="text-foreground font-medium">Schedule and Regions</h4>
        <p className="text-muted-foreground text-sm">
          Customize the period of time and the regions where your endpoint will
          be monitored.
        </p>
      </div> */}
      <FormField
        control={form.control}
        name="notifications"
        // biome-ignore lint/correctness/noUnusedVariables: <explanation>
        render={({ field }) => {
          return (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Notifications</FormLabel>
                <FormDescription>
                  Select the notification channels you want to be informed.
                </FormDescription>
              </div>
              <div className="grid grid-cols-1 grid-rows-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {notifications?.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="notifications"
                    render={({ field }) => {
                      return (
                        <FormItem key={item.id} className="h-full w-full">
                          <FormControl className="h-full">
                            <CheckboxLabel
                              id={String(item.id)}
                              name={"notification"}
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
                              <span>{item.name}</span>
                              <span>
                                <Badge variant="secondary">
                                  {item.provider}
                                </Badge>
                              </span>
                            </CheckboxLabel>
                          </FormControl>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              {!notifications || notifications.length === 0 ? (
                <FormDescription>
                  Create some notifications first.
                </FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          );
        }}
      />
    </div>
  );
}
