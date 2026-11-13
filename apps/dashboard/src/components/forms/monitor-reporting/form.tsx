"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import { cn } from "@openstatus/ui/lib/utils";
import { isTRPCClientError } from "@trpc/client";
import React, { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import { parseSlaTarget } from "@/data/reportings.client";

import {
  type MonitorOption,
  SlaMonitorsField,
  SlaStrictField,
  SlaTargetField,
  SlaTimeZoneField,
  slaTargetSchemaError,
} from "./fields";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  target: z.string().refine((v) => parseSlaTarget(v) !== null, {
    error: slaTargetSchemaError,
  }),
  strict: z.boolean(),
  timeZone: z.string().min(1),
  monitorIds: z.array(z.number()),
});

export type FormValues = z.infer<typeof schema>;

export function FormMonitorReporting({
  onSubmit,
  className,
  monitors,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  monitors: MonitorOption[];
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      target: "99.9",
      strict: false,
      timeZone: "UTC",
      monitorIds: [],
    },
  });
  const [isPending, startTransition] = useTransition();
  const { setIsDirty } = useFormSheetDirty();

  const formIsDirty = form.formState.isDirty;
  React.useEffect(() => {
    setIsDirty(formIsDirty);
  }, [formIsDirty, setIsDirty]);

  const strict = useWatch({ control: form.control, name: "strict" });

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: () => "Saved",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to save";
          },
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form
        className={cn("grid gap-4", className)}
        onSubmit={form.handleSubmit(submitAction)}
        {...props}
      >
        <FormCardContent className="grid gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enterprise contract" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="target"
            render={({ field }) => (
              <SlaTargetField value={field.value} onChange={field.onChange} />
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="timeZone"
            render={({ field }) => (
              <SlaTimeZoneField value={field.value} onChange={field.onChange} />
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="strict"
            render={({ field }) => (
              <SlaStrictField value={field.value} onChange={field.onChange} />
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="monitorIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monitors</FormLabel>
                <FormDescription>
                  Each one is judged on its own. A monitor can be in several
                  reportings.
                </FormDescription>
                <SlaMonitorsField
                  monitors={monitors}
                  value={field.value}
                  onChange={field.onChange}
                  strict={strict}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
      </form>
    </Form>
  );
}
