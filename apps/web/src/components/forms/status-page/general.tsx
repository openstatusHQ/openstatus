"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertPage } from "@openstatus/db/src/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  InputWithAddons,
} from "@openstatus/ui";

import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertPage>;
}

export function General({ form }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
      <SectionHeader
        title="Basic information"
        description="The public status page to update your users on service uptime."
      />
      <div className="grid gap-4 sm:col-span-2">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Documenso Status" {...field} />
              </FormControl>
              <FormDescription>The title of your page.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <InputWithAddons
                  placeholder="documenso"
                  trailing={".openstatus.dev"}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The subdomain for your status page. At least 3 chars.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
