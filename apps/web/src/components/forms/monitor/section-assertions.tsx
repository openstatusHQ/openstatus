"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertMonitor } from "@openstatus/db/src/schema";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui";
import { statusCodes } from "@openstatus/utils";

import { cn } from "@/lib/utils";
import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertMonitor>;
}

export function SectionAssertions({ form }: Props) {
  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Assertions"
        description="Validate the response to ensure your service is working as expected."
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <FormField
          control={form.control}
          name="statusCode"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Expected Status Code</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "h-auto justify-between",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      {field.value && field.value.length > 0
                        ? statusCodes
                            .filter(
                              (statusCode) =>
                                field.value?.includes(statusCode.value),
                            )
                            ?.map(({ value }) => value)
                            .join(", ")
                        : "Select status code"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command className="w-[var(--radix-popover-trigger-width)]">
                    <CommandInput placeholder="Search status code..." />
                    <CommandEmpty>No status code found.</CommandEmpty>
                    <CommandGroup className="max-h-[145px] overflow-auto">
                      {statusCodes.map((statusCode) => (
                        <CommandItem
                          value={String(statusCode.value)}
                          key={statusCode.value}
                          onSelect={() => {
                            form.setValue(
                              "statusCode",
                              field.value?.includes(statusCode.value)
                                ? field.value?.filter(
                                    (status) => status !== statusCode.value,
                                  )
                                : [...(field.value || []), statusCode.value],
                            );
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              field.value?.includes(statusCode.value)
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {statusCode.value}
                          <span className="text-muted-foreground ml-1 truncate">
                            {statusCode.label}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormDescription>
                By default, a valid status code is <code>2xx</code>.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
