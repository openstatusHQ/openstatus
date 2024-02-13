"use client";

import type { UseFormReturn } from "react-hook-form";

import type { InsertStatusReportUpdate } from "@openstatus/db/src/schema";
import {
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

interface Props {
  form: UseFormReturn<InsertStatusReportUpdate>;
}
export function SectionMessage({ form }: Props) {
  return (
    <FormField
      control={form.control}
      name="message"
      render={({ field }) => (
        <FormItem className="sm:col-span-full">
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
  );
}
