"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type * as z from "zod";

import {
  insertMonitorSchema,
  periodicityEnum,
} from "@openstatus/db/src/schema";

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
} from "../ui/select";

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
                  This is url you want to monitor.
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
                  The name of the monitor that will be displayed.
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
                  Give your user some information about it.
                </FormDescription>
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
                    <SelectItem value="1m" disabled>
                      1 minute
                    </SelectItem>
                    <SelectItem value="5m" disabled>
                      5 minutes
                    </SelectItem>
                    <SelectItem value="10m">10 minutes</SelectItem>
                    <SelectItem value="30m" disabled>
                      30 minutes
                    </SelectItem>
                    <SelectItem value="1h" disabled>
                      1 hour
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  How often your endpoint will be checked
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
