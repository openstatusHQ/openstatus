"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertMaintenance } from "@openstatus/db/src/schema";
import {
  DateTimePickerPopover,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from "@openstatus/ui";

import { format } from "date-fns";
import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertMaintenance>;
}

export function General({ form }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
      <SectionHeader
        title="Maintenance Information"
        description="Give your users a heads up when you're doing maintenance."
      />
      <div className="flex w-full flex-col gap-4 sm:col-span-2">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Database migration" {...field} />
              </FormControl>
              <FormDescription>Displayed on the status page.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem className="col-span-full">
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="We're doing some maintenance. We'll be back soon!"
                  {...field}
                />
              </FormControl>
              <FormDescription>Give your users some context.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="from"
            render={({ field }) => (
              <FormItem className="flex w-full flex-col">
                <FormLabel>From</FormLabel>
                <DateTimePickerPopover
                  date={field.value ? new Date(field.value) : new Date()}
                  setDate={(date) => {
                    field.onChange(date);
                  }}
                  className="w-full"
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="to"
            render={({ field }) => (
              <FormItem className="flex w-full flex-col">
                <FormLabel>To</FormLabel>
                <DateTimePickerPopover
                  date={
                    field.value
                      ? new Date(field.value)
                      : new Date(Date.now() + 1000 * 60 * 60)
                  }
                  setDate={(date) => {
                    field.onChange(date);
                  }}
                  className="w-full"
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormDescription className="sm:-mt-2 col-span-full">
            The period{" "}
            <span className="font-medium">
              in local time {format(new Date(), "z")}
            </span>{" "}
            when the maintenance takes place.
          </FormDescription>
        </div>
      </div>
    </div>
  );
}
