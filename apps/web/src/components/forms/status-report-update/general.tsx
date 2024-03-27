"use client";

import type { UseFormReturn } from "react-hook-form";

import {
  statusReportStatus,
  statusReportStatusSchema,
} from "@openstatus/db/src/schema";
import type { InsertStatusReportUpdate } from "@openstatus/db/src/schema";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { statusDict } from "@/data/incidents-dictionary";

interface Props {
  form: UseFormReturn<InsertStatusReportUpdate>;
}
export function General({ form }: Props) {
  return (
    <FormField
      control={form.control}
      name="status"
      render={({ field }) => (
        <FormItem className="space-y-1 sm:col-span-full">
          <FormLabel>Status</FormLabel>
          <FormMessage />
          <RadioGroup
            onValueChange={(value) =>
              field.onChange(statusReportStatusSchema.parse(value))
            } // value is a string
            defaultValue={field.value}
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {statusReportStatus.map((status) => {
              const { value, label, icon } = statusDict[status];
              const Icon = Icons[icon];
              return (
                <FormItem key={value}>
                  <FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:text-foreground">
                    <FormControl>
                      <RadioGroupItem value={value} className="sr-only" />
                    </FormControl>
                    <div className="flex w-full items-center justify-center rounded-lg border border-border px-3 py-2 text-center text-muted-foreground text-sm">
                      <Icon className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </div>
                  </FormLabel>
                </FormItem>
              );
            })}
          </RadioGroup>
        </FormItem>
      )}
    />
  );
}
