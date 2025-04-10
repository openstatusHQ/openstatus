"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import { cn } from "@/lib/utils";
import {
  statusReportSeverity,
  statusReportSeveritySchema,
  statusReportStatus,
  statusReportStatusSchema,
} from "@openstatus/db/src/schema";
import type { InsertStatusReport } from "@openstatus/db/src/schema";
import {
  Button,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { severityDict, statusDict } from "@/data/incidents-dictionary";
import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertStatusReport>;
}

export function General({ form }: Props) {
  const watchSeverity = form.watch("severity");

  return (
    <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
      <SectionHeader
        title="Inform"
        description="Keep your users informed about what just happened."
      />
      <div className="grid gap-4 sm:col-span-2">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Downtime..." {...field} />
              </FormControl>
              <FormDescription>The title of your outage.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>Status</FormLabel>
              <FormDescription>Select the current status.</FormDescription>
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
        <FormField
          control={form.control}
          name="severity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Severity</FormLabel>
              <div className="grid sm:grid-cols-4 gap-4">
                <Select
                  key={field.value} // NOTE: required to re-render the select when the value set undefined
                  onValueChange={field.onChange}
                  value={field.value ?? undefined}
                >
                  <FormControl>
                    <SelectTrigger className="col-span-2">
                      <SelectValue placeholder="Select a severity" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statusReportSeverity.map((severity) => {
                      const { value, label, level, color } =
                        severityDict[severity];
                      return (
                        <SelectItem
                          key={value}
                          value={value}
                          className="[&>span:last-child]:flex [&>span:last-child]:items-center [&>span:last-child]:justify-between [&>span:last-child]:w-full"
                        >
                          <span>{label}</span>
                          <span
                            className={cn(
                              "text-xs ml-2 font-normal font-mono rounded-full px-1 border",
                              color,
                            )}
                          >
                            Level {level}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {watchSeverity ? (
                  <Button
                    variant="ghost"
                    className="h-auto"
                    type="button"
                    onClick={() => field.onChange(undefined)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <FormDescription>
                Learn more about the{" "}
                <a
                  href="https://docs.openstatus.dev/status-report/severity"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium"
                >
                  severity levels
                </a>
                .
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
