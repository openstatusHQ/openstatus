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

export function SectionEmail({ form }: Props) {
  return (
    <FormField
      control={form.control}
      name="data.email"
      render={({ field }) => (
        <FormItem className="sm:col-span-full">
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input
              type="email"
              placeholder="dev@documenso.com"
              required
              {...field}
            />
          </FormControl>
          <FormDescription className="flex items-center justify-between">
            The email is required.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
