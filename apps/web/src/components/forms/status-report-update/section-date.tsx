"use client";

import type { UseFormReturn } from "react-hook-form";

import type { InsertStatusReportUpdate } from "@openstatus/db/src/schema";
import {
  DateTimePicker,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui";

interface Props {
  form: UseFormReturn<InsertStatusReportUpdate>;
}
export function SectionDate({ form }: Props) {
  return (
    <FormField
      control={form.control}
      name="date"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Date</FormLabel>
          <DateTimePicker
            className="max-w-min rounded-md border"
            date={new Date(field.value)}
            setDate={(date) => {
              field.onChange(date);
            }}
          />
          <FormDescription>
            The date and time when the incident took place.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
