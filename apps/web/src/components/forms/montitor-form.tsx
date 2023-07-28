"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type * as z from "zod";

import {
  insertMonitorSchema,
  periodicityEnum,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const limit = allPlans.free.limits.periodicity;
const cronJobs = [
  { value: "1m", label: "1 minute" },
  { value: "5m", label: "5 minutes" },
  { value: "10m", label: "10 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
] as const;

type Schema = z.infer<typeof insertMonitorSchema>;

interface Props {
  id: string;
  defaultValues?: Schema;
  onSubmit: (values: Schema) => Promise<void>;
}

export function MonitorForm({ id, defaultValues, onSubmit }: Props) {
  const form = useForm<Schema>({
    resolver: zodResolver(insertMonitorSchema), // too much - we should only validate the values we ask inside of the form!
    defaultValues: {
      url: defaultValues?.url || "",
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      periodicity: defaultValues?.periodicity || undefined,
      active: defaultValues?.active || false,
      id: defaultValues?.id || undefined,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} id={id}>
        <div className="grid w-full items-center space-y-6">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL</FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormDescription>
                  Here is the URL you want to monitor.{" "}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormDescription>
                  The name of the monitor displayed on the status page.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormDescription>
                  Provide your users with information about it.{" "}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Active</FormLabel>
                  <FormDescription>
                    This will start ping your endpoint on based on the selected
                    frequence.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value || false}
                    onCheckedChange={(value) => field.onChange(value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="periodicity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Periodicity</FormLabel>
                <Select
                  onValueChange={(value) =>
                    field.onChange(periodicityEnum.parse(value))
                  }
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="How often should it check your endpoint?" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cronJobs.map(({ label, value }) => (
                      <SelectItem
                        key={value}
                        value={value}
                        disabled={!limit.includes(value)}
                      >
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Frequency of how often your endpoint will be pinged.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
