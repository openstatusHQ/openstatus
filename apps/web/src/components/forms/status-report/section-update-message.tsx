"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertStatusReport } from "@openstatus/db/src/schema";
import {
  DateTimePickerPopover,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@openstatus/ui";

import { Preview } from "@/components/content/preview";
import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertStatusReport>;
}

export function SectionUpdateMessage({ form }: Props) {
  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Status Update Message"
        description="Describe the current status of the incident."
      />
      <FormField
        control={form.control}
        name="message"
        render={({ field }) => (
          <FormItem className="sm:col-span-4">
            <FormLabel>Message</FormLabel>
            <Tabs defaultValue="write">
              <TabsList>
                <TabsTrigger value="write">Write</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="write">
                <FormControl>
                  <Textarea
                    placeholder="We are encountering..."
                    className="h-auto w-full resize-none"
                    rows={9}
                    {...field}
                  />
                </FormControl>
              </TabsContent>
              <TabsContent value="preview">
                <Preview md={form.getValues("message")} />
              </TabsContent>
            </Tabs>
            <FormDescription>
              Tell your user what&apos;s happening. Supports markdown.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem className="flex flex-col sm:col-span-full">
            <FormLabel>Date</FormLabel>
            <DateTimePickerPopover
              date={field.value ? new Date(field.value) : new Date()}
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
    </div>
  );
}
