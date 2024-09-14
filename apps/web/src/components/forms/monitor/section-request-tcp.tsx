"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertMonitor } from "@openstatus/db/src/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

// TODO: add `port` and `host` field instead!

interface Props {
  form: UseFormReturn<InsertMonitor>;
}

export function SectionRequestTCP({ form }: Props) {
  return (
    <div className="grid w-full gap-4">
      <div className="grid gap-4 sm:grid-cols-7">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem className="sm:col-span-5">
              <FormLabel>Host:Port</FormLabel>
              <FormControl>
                <Input
                  className="bg-muted"
                  placeholder="192.168.1.1:80"
                  {...field}
                />
              </FormControl>
              <FormMessage />
              <FormDescription>
                The input supports both IPv4 addresses and IPv6 addresses.
              </FormDescription>
            </FormItem>
          )}
        />
      </div>
      <div className="text-sm">
        <p>Examples:</p>
        <ul className="list-inside list-disc text-muted-foreground">
          <li>
            Domain: <code className="text-foreground">openstatus.dev:443</code>
          </li>
          <li>
            IPv4: <code className="text-foreground">192.168.1.1:443</code>
          </li>
          <li>
            IPv6:{" "}
            <code className="text-foreground">
              [2001:db8:85a3:8d3:1319:8a2e:370:7348]:443
            </code>
          </li>
        </ul>
      </div>
    </div>
  );
}
