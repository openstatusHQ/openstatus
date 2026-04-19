"use client";

import { CheckboxTree } from "@/components/ui/checkbox-tree";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";

import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import { cn } from "@openstatus/ui/lib/utils";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  provider: z.enum([
    "slack",
    "discord",
    "email",
    "sms",
    "webhook",
    "opsgenie",
    "pagerduty",
    "ntfy",
    "telegram",
    "whatsapp",
    "google-chat",
    "grafana-oncall",
  ]),
  data: z.record(z.string(), z.any()).or(z.string()),
  monitors: z.array(z.number()),
});

export type FormValues = z.infer<typeof schema>;

export function NotifierForm({
  defaultValues,
  className,
  onSubmit,
  monitors,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit?: (values: FormValues) => Promise<void> | void;
  monitors: { id: number; name: string }[];
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: "",
      data: {
        webhook: "",
      },
      monitors: [],
    },
  });
  const [isPending, startTransition] = useTransition();

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = new Promise((resolve) => setTimeout(resolve, 1000));
        toast.promise(promise, {
          loading: "Saving...",
          success: () => JSON.stringify(values),
          error: "Failed to save",
        });
        await promise;
        onSubmit?.(values);
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form
        id="notifier-form"
        className={cn("grid gap-4", className)}
        onSubmit={form.handleSubmit(submitAction)}
        {...props}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="My Notifier" {...field} />
              </FormControl>
              <FormMessage />
              <FormDescription>
                Enter a descriptive name for your notifier.
              </FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="data.webhook"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Webhook URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/webhook" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="monitors"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monitors</FormLabel>
              <FormDescription>
                Select the monitors you want to notify.
              </FormDescription>
              <FormControl>
                <CheckboxTree
                  items={[
                    {
                      id: -1,
                      label: "Select all",
                      children: monitors.map((m) => ({
                        id: m.id,
                        label: m.name,
                      })),
                    },
                  ]}
                  value={field.value ?? []}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
