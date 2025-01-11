"use client";

import type { UseFormReturn } from "react-hook-form";

import type { InsertNotificationWithData } from "@openstatus/db/src/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
}

export function SectionSms({ form }: Props) {
  return (
    <FormField
      control={form.control}
      name="data.sms"
      render={({ field }) => (
        <FormItem className="sm:col-span-full">
          <FormLabel>Phone Number</FormLabel>
          <FormControl>
            <Input type="tel" placeholder="+1234567890" required {...field} />
          </FormControl>
          <FormDescription className="flex items-center justify-between">
            The phone number is required.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
